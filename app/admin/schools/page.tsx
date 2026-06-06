import { redirect } from "next/navigation";

export default function SchoolsIndexPage() {
  redirect("/admin/schools/list");
}