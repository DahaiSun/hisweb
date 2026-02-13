import { AdminWorkbench } from "./workbench";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <div className="page-block stack">
      <section className="hero">
        <span className="eyebrow">Editor Console</span>
        <h1>Admin Workbench</h1>
        <p>
          Create events and sources, link them, then publish. This page uses the current temporary
          API auth header (`x-role`).
        </p>
      </section>
      <AdminWorkbench />
    </div>
  );
}
