"""CSV folder connector: a service is a folder (inside the import directory), each *.csv file is a table."""
from __future__ import annotations

import csv
import re
from typing import Iterator

from .base import (
    ColumnInfo,
    ConnectorError,
    FieldSpec,
    SourceConnector,
    TableInfo,
    greater_than,
    import_root,
    safe_path,
)

FILE_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.\- ]{0,100}\.csv$")


class CsvConnector(SourceConnector):
    type = "csv"
    label = "CSV folder"
    fields = [
        FieldSpec("folder", "Folder (relative to the import directory)", required=True,
                  help="Upload files into this folder from the service page, or place them in the mounted import directory."),
        FieldSpec("delimiter", "Delimiter", required=False, default=",", choices=[",", ";", "|", "\t"]),
        FieldSpec("encoding", "Encoding", required=False, default="utf-8-sig", choices=["utf-8-sig", "utf-8", "cp1256", "latin-1"]),
    ]

    @classmethod
    def _validate_extra(cls, config: dict, secrets: dict) -> None:
        safe_path(config["folder"], must_exist=False)  # raises when it escapes the import directory

    def _folder(self):
        folder = safe_path(self.config["folder"])
        if not folder.is_dir():
            raise ConnectorError("folder is not a directory")
        return folder

    def _open(self, name: str):
        if not FILE_NAME_RE.match(name):
            raise ConnectorError("invalid file name")
        path = (self._folder() / name).resolve()
        try:
            path.relative_to(import_root())  # a symlink must not lead out of the import directory
        except ValueError:
            raise ConnectorError("path escapes the import folder") from None
        if not path.is_file():
            raise ConnectorError(f"file '{name}' not found")
        return open(path, newline="", encoding=self.config.get("encoding", "utf-8-sig"))

    def _files(self) -> list[str]:
        return sorted(p.name for p in self._folder().iterdir() if p.is_file() and FILE_NAME_RE.match(p.name))

    def test_connection(self) -> str:
        files = self._files()
        return f"folder reachable, {len(files)} CSV file(s)"

    def discover(self) -> list[TableInfo]:
        tables = []
        for name in self._files():
            with self._open(name) as handle:
                header = next(csv.reader(handle, delimiter=self.config.get("delimiter", ",")), None)
            if not header:
                raise ConnectorError(f"'{name}' has no header row")
            cleaned = [h.strip() for h in header]
            if any(not h for h in cleaned) or len(set(cleaned)) != len(cleaned):
                raise ConnectorError(f"'{name}' has empty or duplicate column names")
            tables.append(TableInfo(name=name, columns=[ColumnInfo(h) for h in cleaned]))
        return tables

    def iterate(self, schema, table, columns, cursor_column=None, watermark=None, column_types=None) -> Iterator[dict]:
        wanted = list(dict.fromkeys(columns + ([cursor_column] if cursor_column else [])))
        with self._open(table) as handle:
            reader = csv.DictReader(handle, delimiter=self.config.get("delimiter", ","))
            if reader.fieldnames is None:
                raise ConnectorError(f"'{table}' has no header row")
            fieldnames = [f.strip() for f in reader.fieldnames]
            missing = [c for c in wanted if c not in fieldnames]
            if missing:
                raise ConnectorError(f"columns not found in '{table}': {', '.join(missing)}")
            reader.fieldnames = fieldnames
            for row in reader:
                if cursor_column and watermark is not None and not greater_than(row.get(cursor_column), watermark):
                    continue
                yield {c: ("" if row.get(c) is None else row[c]) for c in wanted}
