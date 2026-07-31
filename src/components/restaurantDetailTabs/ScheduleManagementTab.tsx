import React, { useState } from 'react';
import { db } from '../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Restaurant, RestaurantTimeSlot, FestivalSchedule, EmergencyClosure } from '../../types';
import {
  Clock,
  Calendar,
  AlertTriangle,
  Power,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Save,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface ScheduleManagementTabProps {
  restaurant: Restaurant;
  onUpdate: () => void;
  logAdminAction: (action: string, details: string, beforeVal?: any, afterVal?: any) => Promise<void>;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function ScheduleManagementTab({
  restaurant,
  onUpdate,
  logAdminAction,
}: ScheduleManagementTabProps) {
  // Opening & Closing
  const [openingTime, setOpeningTime] = useState(restaurant.openingTime || '09:00');
  const [closingTime, setClosingTime] = useState(restaurant.closingTime || '23:00');

  // Weekly Holidays
  const [weeklyHolidays, setWeeklyHolidays] = useState<string[]>(restaurant.weeklyHolidays || []);

  // Multiple Time Slots
  const [timeSlots, setTimeSlots] = useState<RestaurantTimeSlot[]>(
    restaurant.timeSlots || [
      { label: 'Lunch Service', open: '11:00', close: '15:00' },
      { label: 'Dinner Service', open: '18:30', close: '23:00' },
    ]
  );

  // Temporary Closed
  const [tempClosed, setTempClosed] = useState<boolean>(restaurant.tempClosed || false);
  const [tempClosedReason, setTempClosedReason] = useState<string>(restaurant.tempClosedReason || '');

  // Festival Schedule
  const [festivalSchedule, setFestivalSchedule] = useState<FestivalSchedule[]>(
    restaurant.festivalSchedule || [
      { festivalName: 'Diwali', date: '2026-11-01', isClosed: true },
      { festivalName: 'Holi', date: '2026-03-04', isClosed: false, customOpen: '14:00', customClose: '23:00' },
    ]
  );

  // Emergency Closure
  const [emergencyClosure, setEmergencyClosure] = useState<EmergencyClosure>(
    restaurant.emergencyClosure || { isClosed: false, reason: '', until: '' }
  );

  // Auto Schedule Flag
  const [autoSchedule, setAutoSchedule] = useState<boolean>(restaurant.autoSchedule ?? true);

  const [isSaving, setIsSaving] = useState(false);

  // Toggle Weekly Holiday
  const handleToggleHoliday = (day: string) => {
    setWeeklyHolidays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  // Add Time Slot
  const handleAddTimeSlot = () => {
    setTimeSlots((prev) => [
      ...prev,
      { label: `Slot ${prev.length + 1}`, open: '12:00', close: '16:00' },
    ]);
  };

  // Remove Time Slot
  const handleRemoveTimeSlot = (index: number) => {
    setTimeSlots((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Festival Item
  const handleAddFestival = () => {
    setFestivalSchedule((prev) => [
      ...prev,
      { festivalName: 'Festival Holiday', date: new Date().toISOString().split('T')[0], isClosed: true },
    ]);
  };

  // Compute Auto-Schedule Live State
  const computeLiveScheduleStatus = () => {
    if (emergencyClosure.isClosed) {
      return { isOpen: false, reason: `Emergency Closure: ${emergencyClosure.reason || 'Unspecified'}` };
    }
    if (tempClosed) {
      return { isOpen: false, reason: `Temporary Closed: ${tempClosedReason || 'Maintenance'}` };
    }

    const now = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = dayNames[now.getDay()];

    if (weeklyHolidays.includes(currentDay)) {
      return { isOpen: false, reason: `Weekly Holiday (${currentDay})` };
    }

    const currentDateStr = now.toISOString().split('T')[0];
    const todayFest = festivalSchedule.find((f) => f.date === currentDateStr);
    if (todayFest) {
      if (todayFest.isClosed) {
        return { isOpen: false, reason: `Festival Closure: ${todayFest.festivalName}` };
      }
    }

    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    // Check time slots if present
    if (timeSlots.length > 0) {
      const inAnySlot = timeSlots.some((slot) => {
        const [oH, oM] = slot.open.split(':').map(Number);
        const [cH, cM] = slot.close.split(':').map(Number);
        const openMin = oH * 60 + oM;
        const closeMin = cH * 60 + cM;
        return currentMinutes >= openMin && currentMinutes <= closeMin;
      });

      if (inAnySlot) return { isOpen: true, reason: 'Active Shift Slot' };
      return { isOpen: false, reason: 'Outside Shift Slot Operating Hours' };
    }

    // Default main open/close check
    const [oH, oM] = openingTime.split(':').map(Number);
    const [cH, cM] = closingTime.split(':').map(Number);
    const openMin = oH * 60 + oM;
    const closeMin = cH * 60 + cM;

    if (currentMinutes >= openMin && currentMinutes <= closeMin) {
      return { isOpen: true, reason: 'Normal Operating Schedule' };
    }

    return { isOpen: false, reason: 'Closed Outside Operating Hours' };
  };

  const computedStatus = computeLiveScheduleStatus();

  // Save Schedule Config to Firestore
  const handleSaveSchedule = async () => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const calculatedIsOpen = autoSchedule ? computedStatus.isOpen : restaurant.isOpen;

      const restRef = doc(db, 'restaurants', restaurant.id);
      const updatePayload = {
        openingTime,
        closingTime,
        weeklyHolidays,
        timeSlots,
        tempClosed,
        tempClosedReason,
        festivalSchedule,
        emergencyClosure,
        autoSchedule,
        isOpen: calculatedIsOpen,
        updatedAt: now,
      };

      await updateDoc(restRef, updatePayload);
      await logAdminAction(
        'UPDATE_SCHEDULE',
        `Updated working hours & schedule management for ${restaurant.name}`
      );

      alert('Working hours & schedule rules saved successfully!');
      onUpdate();
    } catch (err: any) {
      alert('Error saving schedule: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Live Computed Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-3">
          <div
            className={`p-3 rounded-2xl border ${
              computedStatus.isOpen
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
            }`}
          >
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100">Live Auto-Schedule Calculation</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Reason: <span className="font-mono text-orange-400 font-bold">{computedStatus.reason}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
              computedStatus.isOpen
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
            }`}
          >
            {computedStatus.isOpen ? 'STORE OPEN' : 'STORE CLOSED'}
          </span>
          <label className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-xl text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={autoSchedule}
              onChange={(e) => setAutoSchedule(e.target.checked)}
              className="accent-orange-500"
            />
            <span className="font-semibold text-slate-300">Auto Schedule Control</span>
          </label>
        </div>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Standard Opening & Closing Hours */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-orange-400" /> Standard Daily Operating Hours
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Opening Time (24h)</label>
              <input
                type="time"
                value={openingTime}
                onChange={(e) => setOpeningTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Closing Time (24h)</label>
              <input
                type="time"
                value={closingTime}
                onChange={(e) => setClosingTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Weekly Holidays */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="text-xs font-mono text-slate-400 block">Weekly Closed Days (Holidays)</label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => {
                const isHoliday = weeklyHolidays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleToggleHoliday(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition cursor-pointer border ${
                      isHoliday
                        ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Multiple Time Slots */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-400" /> Multiple Operational Time Slots
            </h4>
            <button
              type="button"
              onClick={handleAddTimeSlot}
              className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Add Slot
            </button>
          </div>

          {timeSlots.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No specific time slots defined. Main opening/closing hours apply.</p>
          ) : (
            <div className="space-y-3">
              {timeSlots.map((slot, index) => (
                <div key={index} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center gap-3">
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(e) => {
                      const updated = [...timeSlots];
                      updated[index].label = e.target.value;
                      setTimeSlots(updated);
                    }}
                    placeholder="Slot Label"
                    className="w-1/3 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none"
                  />
                  <input
                    type="time"
                    value={slot.open}
                    onChange={(e) => {
                      const updated = [...timeSlots];
                      updated[index].open = e.target.value;
                      setTimeSlots(updated);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 outline-none"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="time"
                    value={slot.close}
                    onChange={(e) => {
                      const updated = [...timeSlots];
                      updated[index].close = e.target.value;
                      setTimeSlots(updated);
                    }}
                    className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveTimeSlot(index)}
                    className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card 3: Temporary Closed Mode */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Power className="w-4 h-4 text-amber-400" /> Temporary Store Pause Mode
            </h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={tempClosed}
                onChange={(e) => setTempClosed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          <div>
            <label className="text-xs font-mono text-slate-400 block mb-1">Temporary Pause Reason</label>
            <input
              type="text"
              value={tempClosedReason}
              onChange={(e) => setTempClosedReason(e.target.value)}
              placeholder="e.g., Kitchen Maintenance / Staff Training / Power Outage"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Card 4: Emergency Closure */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-rose-400 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" /> Emergency Store Closure Override
            </h4>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={emergencyClosure.isClosed}
                onChange={(e) => setEmergencyClosure((prev) => ({ ...prev, isClosed: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Emergency Reason</label>
              <input
                type="text"
                value={emergencyClosure.reason || ''}
                onChange={(e) => setEmergencyClosure((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder="Severe Weather / Fire / Curfew"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-rose-500"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-slate-400 block mb-1">Expected Reopen Date</label>
              <input
                type="date"
                value={emergencyClosure.until || ''}
                onChange={(e) => setEmergencyClosure((prev) => ({ ...prev, until: e.target.value }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 font-mono outline-none focus:border-rose-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Card 5: Festival & Special Calendar Schedule */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" /> Festival & Special Calendar Overrides
          </h4>
          <button
            type="button"
            onClick={handleAddFestival}
            className="bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add Festival Rule
          </button>
        </div>

        <div className="space-y-3">
          {festivalSchedule.map((item, idx) => (
            <div key={idx} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={item.festivalName}
                onChange={(e) => {
                  const updated = [...festivalSchedule];
                  updated[idx].festivalName = e.target.value;
                  setFestivalSchedule(updated);
                }}
                placeholder="Festival Name"
                className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-100 outline-none"
              />
              <input
                type="date"
                value={item.date}
                onChange={(e) => {
                  const updated = [...festivalSchedule];
                  updated[idx].date = e.target.value;
                  setFestivalSchedule(updated);
                }}
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono text-slate-100 outline-none"
              />
              <label className="flex items-center gap-1.5 text-xs text-slate-300 font-mono cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.isClosed}
                  onChange={(e) => {
                    const updated = [...festivalSchedule];
                    updated[idx].isClosed = e.target.checked;
                    setFestivalSchedule(updated);
                  }}
                  className="accent-orange-500"
                />
                Closed All Day
              </label>

              <button
                type="button"
                onClick={() => setFestivalSchedule((prev) => prev.filter((_, i) => i !== idx))}
                className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer ml-auto"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Save Action Bar */}
      <div className="flex justify-end pt-4 border-t border-slate-800">
        <button
          onClick={handleSaveSchedule}
          disabled={isSaving}
          className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 px-6 py-2.5 rounded-xl font-bold text-xs transition shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-40"
        >
          <Save className="w-4 h-4 stroke-[2.5]" /> Save Schedule & Hours Configuration
        </button>
      </div>
    </div>
  );
}
