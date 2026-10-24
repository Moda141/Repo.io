import { message } from "antd";
import { ApiError } from "./api";

export const errText = (e: unknown): string => (e instanceof ApiError ? e.message : "Request failed");
export const fail = (e: unknown) => { message.error(errText(e)); };
export const canWrite = (role: string) => role === "admin" || role === "steward";

export function PageTitle({ title, sub, extra }: { title: string; sub?: string; extra?: React.ReactNode }) {
  return (
    <>
      <div className="page-header"><h1>{title}</h1>{extra}</div>
      {sub && <p className="page-sub">{sub}</p>}
    </>
  );
}
