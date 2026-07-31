import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore';
import { Restaurant, RestaurantAuditLog } from '../../types';
import { exportToPDF, exportToExcel } from '../../services/exportService';
import {
  History,
  Shield,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Clock,
  UserCheck,
  Laptop,
  Globe,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AuditLogsTabProps {
  restaurant: Restaurant;
  onUpdate: () => void;
  logAdminAction: (action: string, details: string, beforeVal?: any, afterVal?: any) => Promise<void>;
}

export default function AuditLogsTab({
  restaurant,
  onUpdate,
  logAdminAction,
}: AuditLogsTabProps) {
  const [logs, setLogs] = useState<RestaurantAuditLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<RestaurantAuditLog | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Realtime subscription to restaurantAuditLogs
  useEffect(() => {
    if (!restaurant.id) return;
    const q = query(
      collection(db, 'restaurantAuditLogs'),
      where('restaurantId', '==', restaurant.id)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: RestaurantAuditLog[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as RestaurantAuditLog);
      });
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(list);
    });

    return () => unsub();
  }, [restaurant.id]);

  // Restore Prior State from Audit Log
  const handleRestoreState = async (auditLog: RestaurantAuditLog) => {
    if (!auditLog.beforeValue) {
      alert('No previous state snapshot captured for this action.');
      return;
    }

    try {
      const parsedBefore = JSON.parse(auditLog.beforeValue);
      if (confirm(`Are you sure you want to restore state from ${new Date(auditLog.timestamp).toLocaleString()}?`)) {
        setIsRestoring(true);
        const restRef = doc(db, 'restaurants', restaurant.id);
        const now = new Date().toISOString();

        await updateDoc(restRef, {
          ...parsedBefore,
          updatedAt: now,
        });

        await logAdminAction(
          'RESTORE_STATE',
          `Restored configuration state from audit log ${auditLog.id} (Action: ${auditLog.action})`
        );

        alert('Restaurant configuration state restored successfully!');
        setSelectedLog(null);
        onUpdate();
      }
    } catch (err: any) {
      alert('Error restoring state: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  // Export Audit Logs PDF
  const handleExportPDF = () => {
    const headers = ['Action', 'Admin Email', 'Details', 'Timestamp'];
    const rows = logs.map((l) => [
      l.action,
      l.adminEmail || 'admin@tingtong.com',
      l.details,
      new Date(l.timestamp).toLocaleString(),
    ]);
    exportToPDF(`Audit Logs - ${restaurant.name}`, headers, rows, `${restaurant.name}_AuditLogs`);
  };

  // Export Audit Logs Excel
  const handleExportExcel = () => {
    const excelData = logs.map((l) => ({
      'Log ID': l.id,
      'Restaurant ID': l.restaurantId,
      'Admin Email': l.adminEmail,
      'Action Performed': l.action,
      'Details': l.details,
      'Timestamp': new Date(l.timestamp).toLocaleString(),
      'Device Info': l.deviceInfo || 'Browser Workstation',
      'IP Address': l.ipAddress || '127.0.0.1',
    }));
    exportToExcel(excelData, `${restaurant.name}_AuditLogs`, 'Audit Logs');
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Shield className="w-5 h-5 text-orange-400" /> Administrative Security & Audit Trail
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable Firestore audit log of all status changes, document approvals, commission edits, and settings modifications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-rose-400" /> PDF
          </button>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center p-8">No administrative audit logs recorded for this merchant yet.</p>
        ) : (
          <div className="space-y-3">
            {logs.map((logItem) => (
              <div
                key={logItem.id}
                className="bg-slate-950 border border-slate-850 hover:border-slate-800 p-4 rounded-2xl transition space-y-2"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full uppercase">
                      {logItem.action}
                    </span>
                    <span className="text-xs font-bold text-slate-200">{logItem.details}</span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" /> {new Date(logItem.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-900">
                  <span className="flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-emerald-400" /> Admin: {logItem.adminEmail || 'admin@tingtong.com'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Laptop className="w-3 h-3 text-cyan-400" /> Device: {logItem.deviceInfo || 'Admin Workstation'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Globe className="w-3 h-3 text-amber-400" /> Network IP: {logItem.ipAddress || '10.0.4.19'}
                  </span>

                  {logItem.beforeValue && (
                    <button
                      onClick={() => setSelectedLog(logItem)}
                      className="ml-auto bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 px-2.5 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> View Diff / Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diff / Restore Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 max-w-xl w-full rounded-2xl p-6 space-y-4 shadow-2xl">
            <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-400" /> Audit Log Diff Inspection & Restoration
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs font-mono">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-rose-400 font-bold uppercase block">Before State Payload</span>
                <pre className="text-[10px] text-slate-300 max-h-48 overflow-auto whitespace-pre-wrap">
                  {selectedLog.beforeValue ? JSON.stringify(JSON.parse(selectedLog.beforeValue), null, 2) : 'N/A'}
                </pre>
              </div>

              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block">After State Payload</span>
                <pre className="text-[10px] text-slate-300 max-h-48 overflow-auto whitespace-pre-wrap">
                  {selectedLog.afterValue ? JSON.stringify(JSON.parse(selectedLog.afterValue), null, 2) : 'N/A'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="bg-slate-800 text-slate-300 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => handleRestoreState(selectedLog)}
                disabled={isRestoring || !selectedLog.beforeValue}
                className="bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs cursor-pointer disabled:opacity-40"
              >
                Revert & Restore Before State
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
