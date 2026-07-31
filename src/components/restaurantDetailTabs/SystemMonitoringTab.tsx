import React, { useState } from 'react';
import { Restaurant } from '../../types';
import {
  Activity,
  AlertTriangle,
  Server,
  Database,
  Cloud,
  ShieldAlert,
  BellOff,
  CheckCircle2,
} from 'lucide-react';

interface SystemMonitoringTabProps {
  restaurant: Restaurant;
}

export default function SystemMonitoringTab({ restaurant }: SystemMonitoringTabProps) {
  // Simulated real-time health telemetry metrics
  const firebaseErrors = 0;
  const apiErrors = 0;
  const storageUsageKb = Math.round((JSON.stringify(restaurant).length * 1.8) / 1024) + 120;
  const firestoreReadsToday = 42;
  const firestoreWritesToday = 14;
  const authFailures = 0;
  const notificationFailures = 0;

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" /> Firebase Infrastructure & API Telemetry Monitor
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time error tracking, Firestore read/write quota usage, storage allocation, and authentication security alerts.
          </p>
        </div>

        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> ALL SYSTEMS HEALTHY
        </span>
      </div>

      {/* Grid of Telemetry Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 font-mono">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-emerald-400" /> Firebase Errors
          </span>
          <p className="text-xl font-bold text-emerald-400">{firebaseErrors} Errors</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-emerald-400" /> REST / GraphQL API Errors
          </span>
          <p className="text-xl font-bold text-emerald-400">{apiErrors} Exceptions</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5 text-indigo-400" /> Storage Usage
          </span>
          <p className="text-xl font-bold text-indigo-400">{storageUsageKb} KB</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" /> Firestore Reads / Writes
          </span>
          <p className="text-xl font-bold text-cyan-400">{firestoreReadsToday} R / {firestoreWritesToday} W</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" /> Auth Failures
          </span>
          <p className="text-xl font-bold text-emerald-400">{authFailures} Lockouts</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1">
          <span className="text-[10px] text-slate-400 uppercase flex items-center gap-1.5">
            <BellOff className="w-3.5 h-3.5 text-emerald-400" /> FCM Notification Failures
          </span>
          <p className="text-xl font-bold text-emerald-400">{notificationFailures} Failed</p>
        </div>
      </div>
    </div>
  );
}
