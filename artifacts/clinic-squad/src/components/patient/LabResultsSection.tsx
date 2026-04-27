import { useRef, useState } from "react";
import {
  useListLabResults,
  useCreateLabResult,
  useDeleteLabResult,
  getListLabResultsQueryKey,
  type LabResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FlaskConical, Plus, Paperclip, Download, Trash2, X, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Props {
  clinicId: string;
  patientId: string;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

export function LabResultsSection({ clinicId, patientId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [testName, setTestName] = useState("");
  const [testDate, setTestDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [resultValue, setResultValue] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data, isLoading } = useListLabResults(clinicId, patientId, {
    query: {
      enabled: !!clinicId && !!patientId,
      queryKey: getListLabResultsQueryKey(clinicId, patientId),
    },
  });

  const createMut = useCreateLabResult();
  const deleteMut = useDeleteLabResult();

  const list = data?.data ?? [];

  function resetForm() {
    setTestName("");
    setTestDate(new Date().toISOString().split("T")[0]);
    setResultValue("");
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testName.trim()) {
      toast({ title: "Test name is required", variant: "destructive" });
      return;
    }
    if (file && file.size > MAX_FILE_BYTES) {
      toast({ title: "Attachment too large", description: "Max size is 5 MB", variant: "destructive" });
      return;
    }

    let attachmentData: string | null = null;
    let attachmentName: string | null = null;
    let attachmentMime: string | null = null;
    if (file) {
      try {
        attachmentData = await readFileAsDataUrl(file);
        attachmentName = file.name;
        attachmentMime = file.type || "application/octet-stream";
      } catch {
        toast({ title: "Failed to read file", variant: "destructive" });
        return;
      }
    }

    try {
      await createMut.mutateAsync({
        clinicId,
        patientId,
        data: {
          testName: testName.trim(),
          testDate,
          resultValue: resultValue.trim() || null,
          attachmentName,
          attachmentMime,
          attachmentData,
        },
      });
      await qc.invalidateQueries({ queryKey: getListLabResultsQueryKey(clinicId, patientId) });
      toast({ title: "Lab result added" });
      resetForm();
      setShowForm(false);
    } catch (err: any) {
      toast({
        title: "Failed to add lab result",
        description: err?.data?.error ?? err?.message ?? "Try again",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this lab result?")) return;
    try {
      await deleteMut.mutateAsync({ clinicId, patientId, labResultId: id });
      await qc.invalidateQueries({ queryKey: getListLabResultsQueryKey(clinicId, patientId) });
      toast({ title: "Deleted" });
    } catch (err: any) {
      toast({
        title: "Failed to delete",
        description: err?.message,
        variant: "destructive",
      });
    }
  }

  function downloadAttachment(r: LabResult) {
    if (!r.attachmentData) return;
    const a = document.createElement("a");
    a.href = r.attachmentData;
    a.download = r.attachmentName ?? `${r.testName}-${r.testDate}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" />
            Lab Results
            <span className="text-xs font-normal text-muted-foreground">({list.length})</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track tests, results, and uploaded reports for this patient.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowForm((s) => !s)}
          data-testid="button-toggle-lab-result"
        >
          {showForm ? <X className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
          {showForm ? "Cancel" : "Add Lab Result"}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border border-border bg-background/40 p-4 space-y-3 mb-5"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="lab-test-name">Test name *</Label>
              <Input
                id="lab-test-name"
                data-testid="input-lab-test-name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="e.g. Complete Blood Count (CBC)"
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label htmlFor="lab-test-date">Date *</Label>
              <Input
                id="lab-test-date"
                data-testid="input-lab-test-date"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="lab-result-value">Result value</Label>
            <Input
              id="lab-result-value"
              data-testid="input-lab-result-value"
              value={resultValue}
              onChange={(e) => setResultValue(e.target.value)}
              placeholder="e.g. Hb 13.2 g/dL — within normal range"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="lab-attachment" className="flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
              Attachment (PDF / image, max 5 MB)
            </Label>
            <Input
              id="lab-attachment"
              data-testid="input-lab-attachment"
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mt-1 file:mr-3 file:rounded file:border-0 file:bg-primary/15 file:px-2 file:py-1 file:text-xs file:text-primary"
            />
            {file && (
              <p className="text-xs text-muted-foreground mt-1">
                {file.name} · {Math.round(file.size / 1024)} KB
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={createMut.isPending}
              data-testid="button-save-lab-result"
            >
              {createMut.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save lab result"
              )}
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-6 text-center">Loading…</div>
      ) : list.length === 0 ? (
        <div className="text-center py-10 border border-dashed border-border rounded-lg">
          <FlaskConical className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No lab results recorded yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="text-left px-3 py-2.5">Date</th>
                <th className="text-left px-3 py-2.5">Test</th>
                <th className="text-left px-3 py-2.5">Result</th>
                <th className="text-left px-3 py-2.5">Attachment</th>
                <th className="text-right px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  data-testid={`lab-result-${r.id}`}
                  className="border-t border-border hover:bg-muted/20 transition-colors"
                >
                  <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(r.testDate)}
                  </td>
                  <td className="px-3 py-2.5 font-medium">{r.testName}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.resultValue ?? "—"}</td>
                  <td className="px-3 py-2.5">
                    {r.attachmentData ? (
                      <button
                        type="button"
                        onClick={() => downloadAttachment(r)}
                        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        data-testid={`download-lab-${r.id}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {r.attachmentName ?? "Download"}
                      </button>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(r.id)}
                      title="Delete"
                      data-testid={`delete-lab-${r.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
