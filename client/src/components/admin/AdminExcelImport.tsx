import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  RefreshCw,
  Sparkles,
  ArrowRight,
  Eye,
  Sliders,
  FileText,
  AlertCircle,
  Trash2,
  X
} from 'lucide-react';

interface AdminExcelImportProps {
  currentUser?: any;
}

export const AdminExcelImport: React.FC<AdminExcelImportProps> = ({ currentUser }) => {
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [activeSheetTab, setActiveSheetTab] = useState<'students' | 'attendance' | 'assignments'>('students');
  const [importMode, setImportMode] = useState<'incremental' | 'replace'>('incremental');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Uploaded sheets & deletion state
  const [uploadedJobs, setUploadedJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<any | null>(null);
  const [deletingJob, setDeletingJob] = useState(false);

  const fetchJobs = async () => {
    setLoadingJobs(true);
    try {
      const res = await api.getImportHistory();
      setUploadedJobs(res.history || []);
    } catch (e) {
      console.error('Failed to load uploaded datasets:', e);
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleDeleteUploadedJob = async () => {
    if (!jobToDelete) return;
    setDeletingJob(true);
    setError(null);
    try {
      const res = await api.deleteImportJob(jobToDelete.id);
      setSuccessNotice(res.message || `Deleted dataset "${jobToDelete.filename}" and its associated records.`);
      setJobToDelete(null);
      await fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to delete dataset.');
    } finally {
      setDeletingJob(false);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = async (selectedFile: File) => {
    setFile(selectedFile);
    setError(null);
    setImportResult(null);
    setLoadingPreview(true);

    try {
      const preview = await api.previewExcel(selectedFile);
      setPreviewData(preview);
    } catch (err: any) {
      setError(err.message || 'Failed to parse Excel file preview.');
    } finally {
      setLoadingPreview(false);
    }
  };

  // Perform actual import
  const handleExecuteImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    try {
      const res = await api.importExcel(file, importMode);
      setImportResult(res.result);
      setFile(null);
      setPreviewData(null);
      await fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Import operation failed.');
    } finally {
      setImporting(false);
    }
  };

  // One-click demo sample loader
  const handleLoadSample = async (type: 'master' | 'incremental' | 'invalid') => {
    setError(null);
    setImportResult(null);
    setLoadingPreview(true);

    try {
      // Fetch official template from backend
      const res = await fetch('/api/admin/excel/template');
      const blob = await res.blob();
      const demoFile = new File([blob], `${type === 'master' ? 'Master_College_Attendance.xlsx' : type === 'incremental' ? 'Batch_Update_Oct17.xlsx' : 'Invalid_Sample_Test.xlsx'}`, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      await handleFileSelected(demoFile);
    } catch (err: any) {
      setError(`Failed to load sample: ${err.message}`);
      setLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider text-blue-400 mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Excel Data Ingestion Pipeline</span>
          </div>
          <h1 className="text-2xl font-bold text-white font-['Outfit']">Excel Import & Synchronization</h1>
          <p className="text-xs text-slate-400 mt-1">
            Upload attendance records, student rosters, and special assignments with automatic CU ID validation.
          </p>
        </div>

        {/* Download Template Button */}
        <a
          href={api.downloadTemplateUrl}
          download="College_Attendance_Assignments_Template.xlsx"
          className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 text-xs font-semibold flex items-center space-x-2 transition self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          <span>Download Official .XLSX Template</span>
        </a>
      </div>

      {/* HOD Departmental Authorization Notice */}
      {currentUser?.role === 'hod' && (
        <div className="p-3.5 rounded-xl bg-indigo-950/70 border border-indigo-800/60 text-indigo-200 text-xs flex items-center space-x-2.5 animate-fadeIn">
          <FileCheck2 className="w-4 h-4 text-indigo-400 flex-shrink-0" />
          <span>
            Authorized Department: <strong>{currentUser.department}</strong>. Uploaded student rows belonging to other branches/departments are securely filtered and skipped.
          </span>
        </div>
      )}

      {/* Success notification */}
      {successNotice && (
        <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between space-x-2.5 animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
          <button type="button" onClick={() => setSuccessNotice(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-start space-x-2.5 animate-fadeIn">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Import Warning</p>
            <p>{error}</p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Import Result Summary Card */}
      {importResult && (
        <div className="glass-panel rounded-2xl p-6 border border-emerald-600/50 bg-emerald-950/20 animate-fadeIn">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white font-['Outfit']">
                Import Processed Successfully
              </h3>
              <p className="text-xs text-emerald-300">
                Data saved and live push dispatched to connected student dashboards.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="text-slate-400">Total Rows Processed</span>
              <p className="text-xl font-bold text-white font-mono">{importResult.totalRows}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="text-slate-400">Students Synchronized</span>
              <p className="text-xl font-bold text-emerald-400 font-mono">{importResult.studentsUpdated}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="text-slate-400">Attendance Logged</span>
              <p className="text-xl font-bold text-sky-400 font-mono">{importResult.attendanceUpdated}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
              <span className="text-slate-400">Assignments Updated</span>
              <p className="text-xl font-bold text-indigo-400 font-mono">{importResult.assignmentsUpdated}</p>
            </div>
          </div>

          {importResult.errorsCount > 0 && (
            <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-rose-300">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>
                  {importResult.errorsCount} row(s) had format issues or missing fields and were safely skipped.
                </span>
              </div>
              <a
                href={api.downloadErrorReportUrl(importResult.jobId)}
                className="px-3 py-1.5 rounded-lg bg-rose-900/80 hover:bg-rose-900 text-rose-100 font-medium transition inline-flex items-center space-x-1"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Error Report (.xlsx)</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Upload Zone */}
      {!previewData && (
        <div className="glass-panel rounded-2xl p-6 sm:p-8 border border-slate-800">
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-950/20'
                : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/40'
            }`}
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-800 text-sky-400 mx-auto flex items-center justify-center mb-4 border border-slate-700">
              <Upload className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white font-['Outfit']">
              Drag & Drop Excel or CSV File Here
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Supports .xlsx, .xls, and .csv files. Accepts multi-sheet workbooks with Students, Attendance, and Assignments.
            </p>

            <div className="mt-6">
              <label
                htmlFor="excel_file_input"
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold cursor-pointer shadow-lg shadow-blue-900/30 transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Select File from Computer</span>
              </label>
              <input
                id="excel_file_input"
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileInput}
                className="hidden"
              />
            </div>
          </div>

          {/* Quick-Test Buttons */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Or Test Instantly with Pre-Generated Files:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleLoadSample('master')}
                disabled={loadingPreview}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left transition group"
              >
                <div className="text-xs font-semibold text-white group-hover:text-sky-300">
                  Load Master College Attendance (.xlsx)
                </div>
                <div className="text-[11px] text-slate-400">
                  Full dataset with Students, 5-Day Attendance, & Special Assignments
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleLoadSample('incremental')}
                disabled={loadingPreview}
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-left transition group"
              >
                <div className="text-xs font-semibold text-white group-hover:text-indigo-300">
                  Load Incremental Batch Update (.xlsx)
                </div>
                <div className="text-[11px] text-slate-400">
                  Updates attendance records idempotently without duplicates
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview & Confirmation Modal/Panel */}
      {previewData && (
        <div className="glass-panel rounded-2xl p-6 border border-slate-700 shadow-2xl space-y-5 animate-fadeIn">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950 text-blue-400 border border-blue-800 flex items-center justify-center">
                <Eye className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">
                  Pre-Import Validation & Preview
                </h3>
                <p className="text-xs text-slate-400">
                  {previewData.filename} ({(previewData.size / 1024).toFixed(1)} KB)
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreviewData(null);
              }}
              className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800"
            >
              Choose Different File
            </button>
          </div>

          {/* Import Mode Selector */}
          <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-xs font-semibold text-white">Import Execution Strategy:</span>
              <p className="text-[11px] text-slate-400">
                Incremental merges records by CU ID; blank cells will not overwrite valid historical data.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setImportMode('incremental')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  importMode === 'incremental'
                    ? 'bg-blue-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Incremental Update (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setImportMode('replace')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  importMode === 'replace'
                    ? 'bg-amber-600 text-white shadow'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Full Replacement
              </button>
            </div>
          </div>

          {/* Sheet Tabs */}
          <div className="flex border-b border-slate-800 space-x-2">
            <button
              type="button"
              onClick={() => setActiveSheetTab('students')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeSheetTab === 'students'
                  ? 'border-blue-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Students Sheet ({previewData.totalRows.students || previewData.preview.students.length} rows)
            </button>
            <button
              type="button"
              onClick={() => setActiveSheetTab('attendance')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeSheetTab === 'attendance'
                  ? 'border-blue-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Attendance Sheet ({previewData.totalRows.attendance || previewData.preview.attendance.length} rows)
            </button>
            <button
              type="button"
              onClick={() => setActiveSheetTab('assignments')}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
                activeSheetTab === 'assignments'
                  ? 'border-blue-500 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Assignments Sheet ({previewData.totalRows.assignments || previewData.preview.assignments.length} rows)
            </button>
          </div>

          {/* Table Preview */}
          <div className="overflow-x-auto max-h-60 rounded-xl border border-slate-800 bg-slate-900/60 text-xs">
            {activeSheetTab === 'students' && (
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono">
                  <tr>
                    <th className="p-2.5">CU_ID</th>
                    <th className="p-2.5">Student_Name</th>
                    <th className="p-2.5">Course</th>
                    <th className="p-2.5">Branch</th>
                    <th className="p-2.5">Semester</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {previewData.preview.students.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2.5 font-mono text-sky-400">{r.cu_id || '—'}</td>
                      <td className="p-2.5 font-medium">{r.student_name || '—'}</td>
                      <td className="p-2.5">{r.course || '—'}</td>
                      <td className="p-2.5">{r.branch || '—'}</td>
                      <td className="p-2.5">{r.semester || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeSheetTab === 'attendance' && (
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono">
                  <tr>
                    <th className="p-2.5">CU_ID</th>
                    <th className="p-2.5">Attendance_Date</th>
                    <th className="p-2.5">Subject</th>
                    <th className="p-2.5 text-center">Total</th>
                    <th className="p-2.5 text-center">Present</th>
                    <th className="p-2.5 text-center">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {previewData.preview.attendance.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2.5 font-mono text-sky-400">{r.cu_id || '—'}</td>
                      <td className="p-2.5 font-mono">{r.attendance_date || '—'}</td>
                      <td className="p-2.5">{r.subject || '—'}</td>
                      <td className="p-2.5 text-center">{r.total_sessions || '—'}</td>
                      <td className="p-2.5 text-center">{r.present_sessions || '—'}</td>
                      <td className="p-2.5 text-center font-bold text-emerald-400">
                        {r.attendance_percentage || 'Auto'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeSheetTab === 'assignments' && (
              <table className="w-full text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono">
                  <tr>
                    <th className="p-2.5">CU_ID</th>
                    <th className="p-2.5">Assignment_ID</th>
                    <th className="p-2.5">Assignment_Name</th>
                    <th className="p-2.5">Deadline</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {previewData.preview.assignments.map((r: any, i: number) => (
                    <tr key={i}>
                      <td className="p-2.5 font-mono text-sky-400">{r.cu_id || '—'}</td>
                      <td className="p-2.5 font-mono">{r.assignment_id || '—'}</td>
                      <td className="p-2.5 font-medium">{r.assignment_name || '—'}</td>
                      <td className="p-2.5 font-mono">{r.submission_deadline || '—'}</td>
                      <td className="p-2.5">{r.submission_status || 'Pending'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Matches students using CU ID as unique identifier.
            </span>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreviewData(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={handleExecuteImport}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-600 hover:from-blue-500 hover:to-sky-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/40 flex items-center space-x-2 transition disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{importing ? 'Importing & Broadcasting...' : 'Confirm & Commit Import'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Excel Data Sheets & Dataset Management (User Requirement) */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-white font-['Outfit'] flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-sky-400" />
              <span>Uploaded Excel Data Sheets ({uploadedJobs.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Current datasets active in the college system. You can delete older or outdated sheets at any time.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchJobs}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 self-start sm:self-auto transition"
            title="Refresh list"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {loadingJobs ? (
          <div className="py-8 text-center text-xs text-slate-500">Loading uploaded sheets...</div>
        ) : uploadedJobs.length === 0 ? (
          <div className="p-6 text-center rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
            No Excel sheets have been uploaded yet. Upload a sheet above to import student attendance.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase font-mono text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Uploaded Sheet</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Admin</th>
                  <th className="py-2.5 px-3 text-center">Records Updated</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {uploadedJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 font-medium text-white flex items-center space-x-2">
                      <FileSpreadsheet className="w-4 h-4 text-blue-400 flex-shrink-0" />
                      <span className="truncate max-w-[220px]" title={job.filename}>{job.filename}</span>
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {new Date(job.created_at).toLocaleDateString()} {new Date(job.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 text-slate-400">{job.uploaded_by}</td>
                    <td className="py-3 px-3 text-center font-mono text-[11px]">
                      <span className="text-sky-300">{job.students_updated} stds</span> •{' '}
                      <span className="text-emerald-300">{job.attendance_updated} attd</span> •{' '}
                      <span className="text-indigo-300">{job.assignments_updated} asns</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setJobToDelete(job)}
                        className="px-2.5 py-1.5 rounded-lg bg-red-950/40 hover:bg-red-900 text-red-300 border border-red-800/50 text-[11px] font-semibold transition inline-flex items-center space-x-1"
                        title="Delete this uploaded Excel dataset and all its records"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                        <span>Delete Sheet</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Delete Sheet */}
      {jobToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="glass-panel max-w-md w-full rounded-2xl p-6 border border-rose-800/60 bg-slate-900 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-400 mb-3">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-['Outfit']">Delete Uploaded Excel Sheet</h3>
                <p className="text-xs text-rose-300/80">Permanent removal of imported records</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Are you sure you want to delete <strong className="text-white font-mono">{jobToDelete.filename}</strong>?
            </p>

            <div className="mt-3 p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1 text-slate-300">
              <p>• Associated Attendance Records: <strong className="text-emerald-300 font-mono">{jobToDelete.attendance_updated}</strong></p>
              <p>• Associated Assignments: <strong className="text-indigo-300 font-mono">{jobToDelete.assignments_updated}</strong></p>
              <p>• Associated Students: <strong className="text-sky-300 font-mono">{jobToDelete.students_updated}</strong></p>
              <p className="text-amber-400 pt-1 text-[10px]">
                ⚠ This will permanently purge attendance and assignment records imported from this Excel file.
              </p>
            </div>

            <div className="mt-5 flex items-center justify-end space-x-3">
              <button
                type="button"
                disabled={deletingJob}
                onClick={() => setJobToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingJob}
                onClick={handleDeleteUploadedJob}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-900/40 flex items-center space-x-1.5 transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deletingJob ? 'Deleting Records...' : 'Yes, Delete Sheet & Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
