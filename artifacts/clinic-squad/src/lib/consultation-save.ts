export type ConsultationDraft = { diagnosis: string; clinicalNotes: string };
export type SaveStatus = "saved" | "unsaved" | "saving" | "error";
export class ConsultationSave {
  private draft: ConsultationDraft = { diagnosis: "", clinicalNotes: "" };
  private revision = 0;
  private savedRevision = 0;
  private pending?: Promise<void>;
  status: SaveStatus = "saved";
  constructor(
    private write: (draft: ConsultationDraft) => Promise<unknown>,
    private notify: () => void,
  ) {}
  initialize(draft: ConsultationDraft) {
    this.draft = draft;
  }
  edit(draft: ConsultationDraft) {
    this.draft = draft;
    this.revision++;
    this.status = "unsaved";
    this.notify();
  }
  get dirty() {
    return this.revision !== this.savedRevision;
  }
  flush(): Promise<void> {
    if (this.pending) return this.pending;
    if (!this.dirty) return Promise.resolve();
    this.pending = this.run().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }
  private async run() {
    try {
      while (this.dirty) {
        const revision = this.revision;
        const draft = { ...this.draft };
        this.status = "saving";
        this.notify();
        await this.write(draft);
        this.savedRevision = revision;
      }
      this.status = "saved";
      this.notify();
    } catch (error) {
      this.status = "error";
      this.notify();
      throw error;
    }
  }
}
