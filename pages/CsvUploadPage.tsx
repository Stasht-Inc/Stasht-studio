import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, Link, CheckCircle, XCircle, AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { tokenUtils } from "../utils/authUtils";
import { toast } from "sonner";

interface ImportSummary {
  total: number;
  success: number;
  failed: number;
  errors?: Array<{ row: number; message: string }>;
  message?: string;
}

export default function CsvUploadPage() {
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls"))) {
      setCsvFile(file);
    } else {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith(".csv") || file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      setCsvFile(file);
    } else {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
    }
  };

  const handleRemoveFile = () => {
    setCsvFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!csvFile) {
      toast.error("Please select a CSV or Excel file");
      return;
    }
    if (!imageUrl.trim()) {
      toast.error("Please enter an image URL");
      return;
    }

    setIsUploading(true);
    setSummary(null);

    try {
      const formData = new FormData();
      formData.append("file", csvFile);
      formData.append("image", imageUrl.trim());

      const token = tokenUtils.getToken();
      const apiBase = import.meta.env.VITE_API_BASE_URL ||
        (import.meta.env.DEV ? "/api/react" : `${window.location.origin}/api/react`);

      const res = await fetch(`${apiBase}/properties/import-excel`, {
        method: "POST",
        // NO Content-Type header — browser sets multipart/form-data + boundary automatically
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      const json = await res.json();

      if (json.status !== "error" && (json.success || json.status === 1 || res.ok)) {
        const data = json.data || json;
        setSummary({
          total: data.total ?? data.total_rows ?? 0,
          success: data.success ?? data.success_count ?? data.imported ?? 0,
          failed: data.failed ?? data.failed_count ?? data.errors_count ?? 0,
          errors: data.errors || data.failed_rows || [],
          message: data.message || "Import completed",
        });
        toast.success("Import completed successfully!");
      } else {
        toast.error(json.message || "Import failed. Please try again.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred during import");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setCsvFile(null);
    setImageUrl("");
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Import Properties</h1>
          <p className="text-gray-500 mt-1 text-sm">Upload a CSV or Excel file to bulk import properties</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">

          {/* CSV File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CSV / Excel File <span className="text-red-500">*</span>
            </label>

            {!csvFile ? (
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
                  isDragging ? "border-[#6C60FF] bg-[#6C60FF]/5" : "border-gray-200 hover:border-[#6C60FF] hover:bg-gray-50"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileSpreadsheet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">
                  Drag & drop your file here, or <span className="text-[#6C60FF]">browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Supports .csv, .xlsx, .xls</p>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3.5 bg-green-50 border border-green-200 rounded-xl">
                <FileSpreadsheet className="w-5 h-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{csvFile.name}</p>
                  <p className="text-xs text-green-600">{(csvFile.size / 1024).toFixed(1)} KB</p>
                </div>
                <button onClick={handleRemoveFile} className="text-green-400 hover:text-green-600 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Image URL <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="pl-9 border-gray-200 focus:border-[#6C60FF] focus:ring-[#6C60FF]"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">This image will be applied to every property in the file</p>
          </div>

          {/* Submit */}
          <Button
            onClick={handleSubmit}
            disabled={isUploading || !csvFile || !imageUrl.trim()}
            className="w-full bg-[#6C60FF] hover:bg-[#5a4fe0] text-white h-11 rounded-xl font-medium"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Properties
              </>
            )}
          </Button>
        </div>

        {/* Summary */}
        {summary && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-gray-900">Import Summary</h2>
              <button
                onClick={handleReset}
                className="text-xs text-[#6C60FF] hover:underline font-medium"
              >
                Import another file
              </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-gray-800">{summary.total}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total Rows</p>
              </div>
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{summary.success}</p>
                <p className="text-xs text-green-600 mt-0.5">Imported</p>
              </div>
              <div className={`rounded-xl p-4 text-center ${summary.failed > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                <p className={`text-2xl font-bold ${summary.failed > 0 ? "text-red-500" : "text-gray-400"}`}>
                  {summary.failed}
                </p>
                <p className={`text-xs mt-0.5 ${summary.failed > 0 ? "text-red-500" : "text-gray-400"}`}>Failed</p>
              </div>
            </div>

            {/* Status banner */}
            {summary.failed === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 font-medium">All rows imported successfully</p>
              </div>
            ) : summary.success === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-100">
                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-700 font-medium">Import failed — no rows were imported</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <p className="text-sm text-yellow-700 font-medium">Partial import — {summary.failed} row(s) failed</p>
              </div>
            )}

            {/* Error list */}
            {summary.errors && summary.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Failed Rows</p>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {summary.errors.map((err, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                      <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                      <span>
                        {err.row ? <strong>Row {err.row}:</strong> : null} {err.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
