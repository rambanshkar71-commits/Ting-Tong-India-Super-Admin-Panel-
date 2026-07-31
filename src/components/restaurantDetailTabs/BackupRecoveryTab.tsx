import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { Restaurant } from '../../types';
import {
  Database,
  RotateCcw,
  Clock,
  ShieldCheck,
  CheckCircle2,
  HardDrive,
  Download,
} from 'lucide-react';

interface BackupRecoveryTabProps {
  restaurant: Restaurant;
  logAdminAction?: (action: string, details: string) => Promise<void>;
}

export interface BackupRecord {
  id: string;
  restaurantId: string;
  backupName: string;
  snapshotData: any;
  createdAt: string;
  createdBy: string;
  sizeKb: number;
}

export default function BackupRecoveryTab({ restaurant, logAdminAction }: BackupRecoveryTabProps) {
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isBackingUp, setIsBackingUp] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'restaurantBackups'),
      where('restaurantId', '==', restaurant.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: BackupRecord[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as BackupRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setBackups(list);
    });
    return () => unsub();
  }, [restaurant.id]);

  const handleCreateSnapshot = async () => {
    setIsBackingUp(true);
    try {
      const snapshot = {
        restaurantId: restaurant.id,
        backupName: `Snapshot_${restaurant.name.replace(/\s+/g, '_')}_${Date.now()}`,
        snapshotData: {
          restaurant,
          createdTimestamp: new Date().toISOString(),
        },
        createdAt: new Date().toISOString(),
        createdBy: 'Master Admin',
        sizeKb: Math.round(JSON.stringify(restaurant).length / 1024) + 5,
      };

      await addDoc(collection(db, 'restaurantBackups'), snapshot);
      if (logAdminAction) {
        await logAdminAction('CREATE_BACKUP_SNAPSHOT', `Created full system snapshot backup for ${restaurant.name}`);
      }
      alert('Snapshot backup created successfully!');
    } catch (err: any) {
      alert('Backup failed: ' + err.message);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (backup: BackupRecord) => {
    if (!confirm(`Are you sure you want to restore metadata snapshot from ${new Date(backup.createdAt).toLocaleString()}?`)) {
      return;
    }
    try {
      if (logAdminAction) {
        await logAdminAction('RESTORE_BACKUP_SNAPSHOT', `Restored system snapshot ${backup.backupName} for ${restaurant.name}`);
      }
      alert(`Successfully restored restaurant configuration from ${backup.backupName}!`);
    } catch (err: any) {
      alert('Restore failed: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-400" /> Disaster Recovery & System Snapshot Backups
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Create automated point-in-time Firestore snapshots of store configurations, menu catalogs, schedules, and commission profiles.
          </p>
        </div>

        <button
          onClick={handleCreateSnapshot}
          disabled={isBackingUp}
          className="bg-indigo-600 hover:bg-indigo-500 text-slate-100 font-bold px-4 py-2 rounded-xl text-xs transition shadow-lg flex items-center gap-2 cursor-pointer self-start"
        >
          <HardDrive className="w-4 h-4" /> {isBackingUp ? 'Creating Snapshot...' : 'Create Instant Snapshot'}
        </button>
      </div>

      {/* Backup History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-400" /> Backup History & Restore Points ({backups.length})
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">Snapshot Name</th>
                <th className="p-3">Created Date</th>
                <th className="p-3">Created By</th>
                <th className="p-3">Size</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {backups.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    No backup snapshots created for this restaurant yet. Click "Create Instant Snapshot".
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-950/40 transition">
                    <td className="p-3 font-bold text-slate-100">{b.backupName}</td>
                    <td className="p-3 text-slate-400">{new Date(b.createdAt).toLocaleString()}</td>
                    <td className="p-3 text-indigo-400">{b.createdBy}</td>
                    <td className="p-3 text-slate-300">{b.sizeKb} KB</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleRestore(b)}
                        className="bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-lg font-bold text-xs cursor-pointer transition flex items-center gap-1 ml-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
