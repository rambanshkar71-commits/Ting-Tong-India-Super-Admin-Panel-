import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { Restaurant } from '../../types';
import {
  Megaphone,
  Bell,
  Calendar,
  AlertOctagon,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface AnnouncementsTabProps {
  restaurant: Restaurant;
  logAdminAction?: (action: string, details: string) => Promise<void>;
}

export interface AnnouncementRecord {
  id: string;
  restaurantId: string;
  type: 'push' | 'in_app' | 'scheduled' | 'emergency';
  title: string;
  message: string;
  scheduledTime?: string;
  createdAt: string;
  author: string;
}

export default function AnnouncementsTab({ restaurant, logAdminAction }: AnnouncementsTabProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [type, setType] = useState<'push' | 'in_app' | 'scheduled' | 'emergency'>('in_app');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'restaurantAnnouncements'),
      where('restaurantId', '==', restaurant.id)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: AnnouncementRecord[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as AnnouncementRecord);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAnnouncements(list);
    });
    return () => unsub();
  }, [restaurant.id]);

  const handlePublish = async () => {
    if (!title.trim() || !message.trim()) {
      alert('Please fill in both title and announcement message.');
      return;
    }
    try {
      const record = {
        restaurantId: restaurant.id,
        type,
        title: title.trim(),
        message: message.trim(),
        scheduledTime: type === 'scheduled' ? scheduledTime : undefined,
        createdAt: new Date().toISOString(),
        author: 'Master Admin',
      };

      await addDoc(collection(db, 'restaurantAnnouncements'), record);
      if (logAdminAction) {
        await logAdminAction('PUBLISH_ANNOUNCEMENT', `Published ${type} announcement to ${restaurant.name}: ${title}`);
      }

      setTitle('');
      setMessage('');
      alert('Announcement published to merchant portal successfully!');
    } catch (err: any) {
      alert('Error publishing announcement: ' + err.message);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-400" /> Restaurant Merchant Announcements & Notices
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Broadcast emergency alerts, scheduled policy updates, and push notifications directly to the merchant partner app.
          </p>
        </div>
      </div>

      {/* Grid: Dispatch Form & Published Feed */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Dispatch Form */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
            <Send className="w-4 h-4 text-orange-400" /> Dispatch Announcement
          </h4>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 font-mono block mb-1">
                Notice Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'in_app', label: 'In-App Notice', icon: Bell },
                  { id: 'push', label: 'Push Notification', icon: Megaphone },
                  { id: 'scheduled', label: 'Scheduled Notice', icon: Calendar },
                  { id: 'emergency', label: 'Emergency Alert', icon: AlertOctagon },
                ].map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setType(cat.id as any)}
                      className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        type === cat.id
                          ? 'bg-orange-500/10 border-orange-500 text-orange-400'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 font-mono block mb-1">
                Announcement Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Revised Commission & Festive SLA Guidelines"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500"
              />
            </div>

            {type === 'scheduled' && (
              <div>
                <label className="text-[10px] font-bold uppercase text-slate-400 font-mono block mb-1">
                  Scheduled Delivery Time
                </label>
                <input
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none focus:border-orange-500 font-mono"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold uppercase text-slate-400 font-mono block mb-1">
                Message Body
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter detailed notice message for merchant..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 h-28 outline-none focus:border-orange-500 resize-none"
              />
            </div>

            <button
              onClick={handlePublish}
              className="w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition shadow-lg cursor-pointer"
            >
              Publish Announcement
            </button>
          </div>
        </div>

        {/* Right: Published Feed */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md max-h-[500px] overflow-y-auto">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Active Dispatches ({announcements.length})
          </h4>

          {announcements.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-mono text-xs">
              No active announcements dispatched to this store yet.
            </div>
          ) : (
            announcements.map((item) => (
              <div key={item.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center">
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                      item.type === 'emergency'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}
                  >
                    {item.type}
                  </span>
                  <span className="text-[10px] text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</span>
                </div>
                <h5 className="font-bold text-slate-100 text-sm font-sans">{item.title}</h5>
                <p className="text-slate-300 font-sans leading-relaxed">{item.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
