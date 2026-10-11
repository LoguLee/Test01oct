import { useEffect, useMemo, useState } from "react";
import "./App.css";

const STORAGE_KEY = "test01oct-project-records-v2";

const emptyProject = {
  projectName: "",
  ipmNumber: "",
  productId: "",
  status: "YTS",
  ftpDate: "",
  permissionDueDate: "",
  allocatedBudget: "",
  estimatedVendorBudget: "",
  budgetSpent: "",
  totalChapters: "",
  chaptersReceived: "",
  chaptersCompleted: "",
  customerRating: "",
  notes: "",
  milestones: [1, 2, 3, 4].map((number) => ({
    number,
    jobId: "",
    amount: "",
    date: "",
    status: "Not billed",
  })),
};

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved)
      ? saved.map((project) => ({
          ...emptyProject,
          ...project,
          milestones: [1, 2, 3, 4].map((number) => ({
            number,
            jobId: "",
            amount: "",
            date: "",
            status: "Not billed",
            ...(project.milestones || []).find((item) => item.number === number),
          })),
        }))
      : [];
  } catch {
    return [];
  }
}

function money(value) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function numberValue(value) {
  return Math.max(0, Number(value || 0));
}

function isOverdue(project) {
  return (
    project.status !== "Completed" &&
    project.permissionDueDate &&
    project.permissionDueDate < new Date().toISOString().slice(0, 10)
  );
}

function App() {
  const [projects, setProjects] = useState(loadProjects);
  const [form, setForm] = useState(emptyProject);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [alertFilter, setAlertFilter] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {
      window.alert("Could not save data in this browser. Export a backup and check browser storage.");
    }
  }, [projects]);

  const totals = useMemo(() => {
    const sum = (key) =>
      projects.reduce((total, project) => total + numberValue(project[key]), 0);
    const billedRevenue = projects.reduce(
      (total, project) =>
        total +
        project.milestones.reduce(
          (milestoneTotal, milestone) =>
            milestoneTotal +
            (milestone.status === "Billed" ? numberValue(milestone.amount) : 0),
          0
        ),
      0
    );
    return {
      count: projects.length,
      yts: projects.filter((project) => project.status === "YTS").length,
      wip: projects.filter((project) => project.status === "WIP").length,
      completed: projects.filter((project) => project.status === "Completed").length,
      allocated: sum("allocatedBudget"),
      vendor: sum("estimatedVendorBudget"),
      spent: sum("budgetSpent"),
      remaining: sum("allocatedBudget") - sum("budgetSpent"),
      revenue: billedRevenue,
      overdue: projects.filter(isOverdue).length,
    };
  }, [projects]);

  const filteredProjects = projects.filter((project) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = [
      project.projectName,
      project.ipmNumber,
      project.productId,
    ].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus =
      statusFilter === "All" || project.status === statusFilter;
    const matchesAlert = !alertFilter || isOverdue(project);
    return matchesSearch && matchesStatus && matchesAlert;
  });

  function openNewProject() {
    setForm({
      ...emptyProject,
      milestones: emptyProject.milestones.map((milestone) => ({ ...milestone })),
    });
    setEditingId(null);
    setShowForm(true);
  }

  function editProject(project) {
    setForm({
      ...emptyProject,
      ...project,
      milestones: project.milestones.map((milestone) => ({ ...milestone })),
    });
    setEditingId(project.id);
    setShowForm(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateMilestone(index, field, value) {
    setForm((current) => ({
      ...current,
      milestones: current.milestones.map((milestone, i) =>
        i === index ? { ...milestone, [field]: value } : milestone
      ),
    }));
  }

  function saveProject(event) {
    event.preventDefault();
    if (!form.projectName.trim()) {
      window.alert("Please enter a project name.");
      return;
    }

    const totalChapters = numberValue(form.totalChapters);
    const chaptersReceived = numberValue(form.chaptersReceived);
    const chaptersCompleted = numberValue(form.chaptersCompleted);

    if (chaptersReceived > totalChapters || chaptersCompleted > totalChapters) {
      window.alert("Chapters received and completed cannot exceed total chapters.");
      return;
    }
    if (chaptersCompleted > chaptersReceived) {
      window.alert("Chapters completed cannot exceed chapters received.");
      return;
    }

    const record = {
      ...form,
      id: editingId || crypto.randomUUID(),
      projectName: form.projectName.trim(),
      milestones: form.milestones.map((milestone, index) => ({
        ...milestone,
        number: index + 1,
      })),
    };

    setProjects((current) =>
      editingId
        ? current.map((project) => (project.id === editingId ? record : project))
        : [record, ...current]
    );
    setShowForm(false);
    setEditingId(null);
    setForm(emptyProject);
  }

  function deleteProject(id) {
    if (window.confirm("Delete this project? This cannot be undone.")) {
      setProjects((current) => current.filter((project) => project.id !== id));
    }
  }

  function exportCSV() {
    const columns = [
      ["projectName", "Project Name"],
      ["ipmNumber", "IPM Number"],
      ["productId", "Product ID"],
      ["status", "Status"],
      ["ftpDate", "FTP Milestone Date"],
      ["permissionDueDate", "Permission Due Date"],
      ["allocatedBudget", "Allocated Budget CAD"],
      ["estimatedVendorBudget", "Estimated Vendor Budget CAD"],
      ["budgetSpent", "Budget Spent CAD"],
      ["totalChapters", "Total Chapters"],
      ["chaptersReceived", "Chapters Received"],
      ["chaptersCompleted", "Chapters Completed"],
      ["customerRating", "Customer Rating"],
      ["notes", "Project Notes"],
      ...[1, 2, 3, 4].flatMap((n) => [
        [`milestone${n}JobId`, `Milestone ${n} Job ID`],
        [`milestone${n}Amount`, `Milestone ${n} Amount CAD`],
        [`milestone${n}Date`, `Milestone ${n} Billing Date`],
        [`milestone${n}Status`, `Milestone ${n} Billing Status`],
      ]),
    ];
    const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = projects.map((project) => {
      const flattened = { ...project };
      project.milestones.forEach((milestone) => {
        flattened[`milestone${milestone.number}JobId`] = milestone.jobId;
        flattened[`milestone${milestone.number}Amount`] = milestone.amount;
        flattened[`milestone${milestone.number}Date`] = milestone.date;
        flattened[`milestone${milestone.number}Status`] = milestone.status;
      });
      return columns.map(([key]) => csvCell(flattened[key])).join(",");
    });
    const csv = [columns.map(([, label]) => csvCell(label)).join(","), ...rows].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "project-register.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const chapterPercent = (project) => {
    const total = numberValue(project.totalChapters);
    return total ? Math.round((numberValue(project.chaptersCompleted) / total) * 100) : 0;
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PROJECT OPERATIONS · CAD</p>
          <h1>Project Management</h1>
          <p className="subtitle">
            Track permissions, chapter progress, billing milestones and budgets.
          </p>
        </div>
        <button className="primary-btn" onClick={openNewProject}>+ Add Project</button>
      </header>

      {totals.overdue > 0 && (
        <section className="alert-banner" role="alert">
          <div>
            <strong>{totals.overdue} overdue permission {totals.overdue === 1 ? "deadline" : "deadlines"}</strong>
            <p>Review projects whose permission due date has passed and which are not completed.</p>
          </div>
          <button className="alert-action" onClick={() => setAlertFilter((current) => !current)}>
            {alertFilter ? "Show all projects" : "View overdue"}
          </button>
        </section>
      )}

      <section className="stats-grid">
        <Stat label="Total Projects" value={totals.count} />
        <Stat label="Work in Progress" value={totals.wip} />
        <Stat label="Yet to Start" value={totals.yts} />
        <Stat label="Completed" value={totals.completed} />
        <Stat label="Total Revenue Generated" value={money(totals.revenue)} detail="Milestones marked Billed" />
        <Stat label="Total Allocated Budget" value={money(totals.allocated)} />
        <Stat label="Estimated Vendor Budget" value={money(totals.vendor)} />
        <Stat label="Total Budget Spent" value={money(totals.spent)} />
        <Stat label="Remaining Budget" value={money(totals.remaining)} detail="Allocated minus spent" />
        <Stat label="Overdue Permissions" value={totals.overdue} alert={totals.overdue > 0} />
      </section>

      <section className="project-section">
        <div className="section-heading">
          <div>
            <h2>Project Register</h2>
            <p>{filteredProjects.length} project(s) displayed</p>
          </div>
          <button className="secondary-btn" onClick={exportCSV}>Export CSV</button>
        </div>

        <div className="toolbar">
          <input
            aria-label="Search projects"
            placeholder="Search project, IPM number or product ID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All statuses</option>
            <option value="YTS">YTS</option>
            <option value="WIP">WIP</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {showForm && (
          <form className="project-form" onSubmit={saveProject}>
            <div className="form-heading">
              <div>
                <p className="eyebrow">{editingId ? "UPDATE RECORD" : "NEW RECORD"}</p>
                <h2>{editingId ? "Edit Project" : "Add Project"}</h2>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowForm(false)} aria-label="Close form">✕</button>
            </div>

            <h3 className="form-section-title">Project details</h3>
            <div className="form-grid">
              <Field label="Project Name" name="projectName" value={form.projectName} onChange={updateField} required />
              <Field label="IPM Number" name="ipmNumber" value={form.ipmNumber} onChange={updateField} />
              <Field label="Product Number / ID" name="productId" value={form.productId} onChange={updateField} />
              <label className="field">
                <span>Current Status</span>
                <select name="status" value={form.status} onChange={updateField}>
                  <option value="YTS">YTS - Yet to Start</option>
                  <option value="WIP">WIP - Work in Progress</option>
                  <option value="Completed">Completed</option>
                </select>
              </label>
              <Field label="FTP Milestone Date" name="ftpDate" type="date" value={form.ftpDate} onChange={updateField} />
              <Field label="Permission Due Date" name="permissionDueDate" type="date" value={form.permissionDueDate} onChange={updateField} />
            </div>

            <h3 className="form-section-title">Budget details (CAD)</h3>
            <div className="form-grid">
              <Field label="Total Allocated Budget (CAD)" name="allocatedBudget" type="number" min="0" step="0.01" value={form.allocatedBudget} onChange={updateField} />
              <Field label="Estimated Vendor Budget (CAD)" name="estimatedVendorBudget" type="number" min="0" step="0.01" value={form.estimatedVendorBudget} onChange={updateField} />
              <Field label="Total Budget Spent (CAD)" name="budgetSpent" type="number" min="0" step="0.01" value={form.budgetSpent} onChange={updateField} />
            </div>

            <h3 className="form-section-title">Chapter completion</h3>
            <div className="form-grid">
              <Field label="Total Chapters" name="totalChapters" type="number" min="0" step="1" value={form.totalChapters} onChange={updateField} />
              <Field label="Chapters Received" name="chaptersReceived" type="number" min="0" step="1" value={form.chaptersReceived} onChange={updateField} />
              <Field label="Chapters Completed" name="chaptersCompleted" type="number" min="0" step="1" value={form.chaptersCompleted} onChange={updateField} />
            </div>
            <div className="chapter-preview">
              <div className="progress-label">
                <span>Chapter completion</span>
                <strong>{chapterPercent(form)}%</strong>
              </div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${chapterPercent(form)}%` }} /></div>
            </div>

            <h3 className="form-section-title">Billing milestones</h3>
            <p className="helper-text">Revenue is counted only for milestones marked “Billed”. Enter the billed amount in CAD.</p>
            <div className="milestone-list">
              {form.milestones.map((milestone, index) => (
                <section className="milestone-card" key={milestone.number}>
                  <h4>Milestone {milestone.number}</h4>
                  <div className="form-grid milestone-grid">
                    <label className="field">
                      <span>Job ID</span>
                      <input value={milestone.jobId} onChange={(event) => updateMilestone(index, "jobId", event.target.value)} placeholder="Enter job ID" />
                    </label>
                    <label className="field">
                      <span>Billing Amount (CAD)</span>
                      <input type="number" min="0" step="0.01" value={milestone.amount} onChange={(event) => updateMilestone(index, "amount", event.target.value)} placeholder="0.00" />
                    </label>
                    <label className="field">
                      <span>Billing Date</span>
                      <input type="date" value={milestone.date} onChange={(event) => updateMilestone(index, "date", event.target.value)} />
                    </label>
                    <label className="field">
                      <span>Billing Status</span>
                      <select value={milestone.status} onChange={(event) => updateMilestone(index, "status", event.target.value)}>
                        <option>Not billed</option>
                        <option>Ready to bill</option>
                        <option>Billed</option>
                        <option>On hold</option>
                      </select>
                    </label>
                  </div>
                </section>
              ))}
            </div>

            <h3 className="form-section-title">Feedback and notes</h3>
            <div className="form-grid">
              <label className="field">
                <span>Customer Rating</span>
                <select name="customerRating" value={form.customerRating} onChange={updateField}>
                  <option value="">Not rated</option>
                  <option value="1">1 - Poor</option>
                  <option value="2">2 - Fair</option>
                  <option value="3">3 - Good</option>
                  <option value="4">4 - Very good</option>
                  <option value="5">5 - Excellent</option>
                </select>
              </label>
              <label className="field full-width">
                <span>Project Notes</span>
                <textarea name="notes" rows="3" value={form.notes} onChange={updateField} placeholder="Project updates, risks, follow-ups or comments..." />
              </label>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary-btn" type="submit">{editingId ? "Save Changes" : "Save Project"}</button>
            </div>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th><th>IPM / Product ID</th><th>Status</th>
                <th>Permission Due</th><th>Chapters Complete</th><th>Billing Progress</th>
                <th>Revenue Billed</th><th>Budget Spent</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => {
                const billed = project.milestones
                  .filter((milestone) => milestone.status === "Billed")
                  .reduce((sum, milestone) => sum + numberValue(milestone.amount), 0);
                const billedCount = project.milestones.filter((milestone) => milestone.status === "Billed").length;
                const overdue = isOverdue(project);
                return (
                  <tr key={project.id}>
                    <td className="project-name">
                      {project.projectName}
                      {overdue && <span className="overdue-tag">Permission overdue</span>}
                    </td>
                    <td>{project.ipmNumber || "—"}<br /><span className="muted">{project.productId || "—"}</span></td>
                    <td><span className={`status status-${project.status.toLowerCase()}`}>{project.status}</span></td>
                    <td>{project.permissionDueDate || "—"}</td>
                    <td>
                      {numberValue(project.chaptersCompleted)} / {numberValue(project.totalChapters)}
                      <div className="mini-progress"><div style={{ width: `${chapterPercent(project)}%` }} /></div>
                      <span className="muted">{chapterPercent(project)}%</span>
                    </td>
                    <td>{billedCount} / 4 billed</td>
                    <td>{money(billed)}</td>
                    <td>{money(project.budgetSpent)}</td>
                    <td className="actions">
                      <button onClick={() => editProject(project)}>Edit</button>
                      <button className="delete-btn" onClick={() => deleteProject(project.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
              {filteredProjects.length === 0 && (
                <tr><td colSpan="9" className="empty-state">No projects found. Add a project to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <footer>Project Management Dashboard · CAD · Data saved in this browser</footer>
    </main>
  );
}

function Stat({ label, value, detail, alert = false }) {
  return (
    <article className={`stat-card${alert ? " stat-alert" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

function Field({ label, name, value, onChange, type = "text", required = false, min, step }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} value={value} onChange={onChange} required={required} min={min} step={step} />
    </label>
  );
}

export default App;
