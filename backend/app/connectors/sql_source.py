"""Relational database connector (PostgreSQL first; MySQL/SQL Server/Oracle need their driver installed).

Read-only by construction: only SELECTs are issued, table/column names are checked against the reflected
schema before use (no string-built SQL), and PostgreSQL sessions are opened with default_transaction_read_only.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Iterator

from sqlalchemy import MetaData, Table, create_engine, inspect, select
from sqlalchemy.engine import URL, Engine
from sqlalchemy.exc import NoSuchTableError, SQLAlchemyError

from ..config import settings
from .base import (
    ColumnInfo,
    ConnectorError,
    FieldSpec,
    SourceConnector,
    TableInfo,
    check_outbound_host,
    coerce_like,
    safe_path,
)

DRIVERS = ["postgresql+psycopg", "mysql+pymysql", "mssql+pymssql", "oracle+oracledb", "sqlite"]


class SqlConnector(SourceConnector):
    type = "database"
    label = "SQL database"
    fields = [
        FieldSpec("drivername", "Database type", default="postgresql+psycopg", choices=DRIVERS),
        FieldSpec("host", "Host", required=False),
        FieldSpec("port", "Port", required=False, kind="number"),
        FieldSpec("database", "Database", help="For sqlite (dev only): a file path inside the import directory."),
        FieldSpec("username", "Username", required=False),
        FieldSpec("password", "Password", secret=True, required=False),
        FieldSpec("schema", "Schema", required=False, help="Defaults to the database's default schema."),
    ]

    def __init__(self, config: dict, secrets: dict):
        super().__init__(config, secrets)
        self._engine: Engine | None = None

    @classmethod
    def _validate_extra(cls, config: dict, secrets: dict) -> None:
        if config["drivername"] == "sqlite":
            if not settings.allow_sqlite_connector:
                raise ConnectorError("the sqlite connector is disabled (it exposes server files)")
            safe_path(config["database"], must_exist=False)
        else:
            if not config.get("host"):
                raise ConnectorError("'Host' is required")
            if not config.get("username"):
                raise ConnectorError("'Username' is required")

    def _engine_(self) -> Engine:
        if self._engine is None:
            driver = self.config["drivername"]
            if driver == "sqlite":
                url = URL.create("sqlite", database=str(safe_path(self.config["database"])))
                self._engine = create_engine(url)
            else:
                check_outbound_host(self.config["host"], self.config.get("port") or 5432)
                url = URL.create(
                    driver,
                    username=self.config.get("username"),
                    password=self.secrets.get("password"),
                    host=self.config.get("host"),
                    port=self.config.get("port"),
                    database=self.config.get("database"),
                )
                args = {"options": "-c default_transaction_read_only=on"} if driver.startswith("postgresql") else {}
                self._engine = create_engine(url, pool_pre_ping=True, connect_args=args)
        return self._engine

    def _wrap(self, exc: Exception) -> ConnectorError:
        # Never echo SQLAlchemy messages: they can contain connection parameters or row values.
        return ConnectorError(f"database error ({type(exc).__name__}); check host, credentials and driver installation")

    def test_connection(self) -> str:
        try:
            with self._engine_().connect() as conn:
                conn.exec_driver_sql("SELECT 1")
        except ConnectorError:
            raise
        except (SQLAlchemyError, ModuleNotFoundError, OSError) as exc:
            raise self._wrap(exc) from None
        return "connected"

    def discover(self) -> list[TableInfo]:
        schema = self.config.get("schema") or None
        try:
            insp = inspect(self._engine_())
            tables = []
            for name in sorted(insp.get_table_names(schema=schema)):
                pk = set(insp.get_pk_constraint(name, schema=schema).get("constrained_columns") or [])
                columns = []
                for col in insp.get_columns(name, schema=schema):
                    try:
                        type_name = str(col["type"])
                    except Exception:  # noqa: BLE001 - exotic types that cannot render themselves
                        type_name = type(col["type"]).__name__
                    columns.append(ColumnInfo(col["name"], type_name, bool(col.get("nullable", True)), col["name"] in pk))
                tables.append(TableInfo(name=name, schema=schema or "", columns=columns))
            return tables
        except ConnectorError:
            raise
        except (SQLAlchemyError, ModuleNotFoundError, OSError) as exc:
            raise self._wrap(exc) from None

    def iterate(self, schema, table, columns, cursor_column=None, watermark=None, column_types=None) -> Iterator[dict]:
        wanted = list(dict.fromkeys(columns + ([cursor_column] if cursor_column else [])))
        try:
            reflected = Table(table, MetaData(), schema=schema or None, autoload_with=self._engine_())
        except NoSuchTableError:
            raise ConnectorError(f"table '{table}' not found") from None
        except (SQLAlchemyError, ModuleNotFoundError, OSError) as exc:
            raise self._wrap(exc) from None
        missing = [c for c in wanted if c not in reflected.c]
        if missing:
            raise ConnectorError(f"columns not found in '{table}': {', '.join(missing)}")
        stmt = select(*[reflected.c[c] for c in wanted])
        if cursor_column:
            cursor = reflected.c[cursor_column]
            if watermark is not None:
                try:
                    sample = cursor.type.python_type
                except NotImplementedError:
                    sample = None
                stmt = stmt.where(cursor > coerce_like(watermark, sample if sample in (int, float, datetime, date) else None))
            stmt = stmt.order_by(cursor)
        try:
            with self._engine_().connect() as conn:
                result = conn.execution_options(stream_results=True).execute(stmt)
                for row in result.mappings():
                    yield dict(row)
        except (SQLAlchemyError, ModuleNotFoundError, OSError) as exc:
            raise self._wrap(exc) from None

    def close(self) -> None:
        if self._engine is not None:
            self._engine.dispose()
            self._engine = None
