import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { 
  Pin, 
  Calendar, 
  Trash2, 
  Edit2, 
  Check, 
  Plus, 
  Megaphone, 
  Users, 
  Tag, 
  Clock, 
  Eye, 
  Info,
  X
} from 'lucide-react';
import { Announcement } from '../../types';
import { getActiveCity } from '../../services/mapService';

export default function AnnouncementCenter() {
  
  // States
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetAudience, setTargetAudience] = useState<Announcement['targetAudience']>('everyone');
  const [category, setCategory] = useState<Announcement['category']>('company_news');
  const [pinned, setPinned] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  
  const [formOpen, setFormOpen] = useState(false);

  // 1. Snapshot Listener for Announcements
  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('pinned', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const items: Announcement[] = [];
      snapshot.forEach(doc => {
        items.push({ id: doc.id, ...doc.data() } as Announcement);
      });
      // Sort pinned first, then newest first
      items.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setAnnouncements(items);
    });

    return () => unsub();
  }, []);

  const handleSubmitAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      alert("Please provide an announcement title and some text content.");
      return;
    }

    try {
      const nowStr = new Date().toISOString();
      const status = scheduledAt ? 'scheduled' : 'active';

      if (editingId) {
        // Update mode
        await updateDoc(doc(db, 'announcements', editingId), {
          title,
          content,
          targetAudience,
          category,
          pinned,
          scheduledAt: scheduledAt || undefined,
          expiresAt: expiresAt || undefined,
          status,
          updatedAt: nowStr
        });
        alert("✓ Announcement updated successfully in real-time.");
      } else {
        // Create mode
        const newRef = doc(collection(db, 'announcements'));
        const docData: Announcement = {
          id: newRef.id,
          title,
          content,
          targetAudience,
          category,
          pinned,
          scheduledAt: scheduledAt || undefined,
          expiresAt: expiresAt || undefined,
          status,
          createdAt: nowStr,
          updatedAt: nowStr
        };
        await setDoc(newRef, docData);
        alert("✓ Announcement published in real-time on target dashboards.");
      }

      // Reset
      resetForm();

    } catch (err: any) {
      alert("Error saving announcement: " + err.message);
    }
  };

  const resetForm = () => {
    setTitle('');
    setContent('');
    setTargetAudience('everyone');
    setCategory('company_news');
    setPinned(false);
    setScheduledAt('');
    setExpiresAt('');
    setEditingId(null);
    setFormOpen(false);
  };

  const handleEditClick = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setTargetAudience(a.targetAudience);
    setCategory(a.category);
    setPinned(a.pinned);
    setScheduledAt(a.scheduledAt || '');
    setExpiresAt(a.expiresAt || '');
    setFormOpen(true);
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (e: any) {
      console.error("Delete failed: ", e);
    }
  };

  const handleTogglePin = async (id: string, currentPinStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'announcements', id), {
        pinned: !currentPinStatus
      });
    } catch (e: any) {
      alert("Toggle Pin failed: " + e.message);
    }
  };

  const getCategoryColor = (cat: string) => {
    if (cat === 'policy_updates') return 'bg-rose-500/10 text-rose-400';
    if (cat === 'payment_updates') return 'bg-amber-500/10 text-amber-500';
    if (cat === 'festival_notice') return 'bg-indigo-500/10 text-indigo-400';
    if (cat === 'offers_promotions') return 'bg-emerald-500/10 text-emerald-400';
    return 'bg-slate-800 text-slate-300';
  };

  return (
    <div className="space-y-6" id="announcement-center-root">
      
      {/* Header and Add button */}
      <div className="flex justify-between items-center bg-slate-900 border border-slate-850 p-4 rounded-3xl">
        <div className="space-y-1">
          <h4 className="font-bold text-sm text-slate-200 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" /> Active General Announcements Board
          </h4>
          <p className="text-[10px] text-slate-500 font-mono">{getActiveCity().name} Hub operations &amp; regulatory bulletins.</p>
        </div>

        {!formOpen && (
          <button
            onClick={() => setFormOpen(true)}
            className="bg-amber-500 hover:brightness-110 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Create Bulletin
          </button>
        )}
      </div>

      {/* CREATE / EDIT FORM DRAWER */}
      {formOpen && (
        <form onSubmit={handleSubmitAnnouncement} className="bg-slate-900 border border-amber-500/35 p-6 rounded-3xl space-y-4 relative">
          <button
            type="button"
            onClick={resetForm}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>

          <h5 className="font-black text-xs uppercase text-slate-400 tracking-wider">
            {editingId ? 'Modify Regulatory Bulletin Node' : 'Initialize New Bulletin Node'}
          </h5>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Bulletin Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`e.g. Diwali Mega Incentive Program ${getActiveCity().name} 2026`}
                className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
              />
            </div>

            {/* Target Audience */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Target Audience Cohort</label>
              <select
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="everyone">Everyone (All Categories)</option>
                <option value="customers">Customers Only</option>
                <option value="riders">Riders Only (Delivery Fleet)</option>
                <option value="vendors">Vendors Only (Restaurant Partners)</option>
                <option value="admins">Admins &amp; Staff Executives</option>
              </select>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Bulletin Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="company_news">Company News &amp; PR</option>
                <option value="festival_notice">Festival Notice &amp; Holidays</option>
                <option value="new_features">New Application Features</option>
                <option value="policy_updates">Regulatory Policy Updates</option>
                <option value="payment_updates">Payment &amp; Commission Updates</option>
                <option value="delivery_updates">Delivery Protocol Updates</option>
                <option value="offers_promotions">Offers &amp; Marketing Promotions</option>
              </select>
            </div>

            {/* Pin State */}
            <div className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-850 rounded-2xl h-[42px] mt-6">
              <input
                type="checkbox"
                id="pin_bulletin"
                checked={pinned}
                onChange={() => setPinned(!pinned)}
                className="rounded text-amber-500 focus:ring-0 bg-slate-900 border-slate-800"
              />
              <label htmlFor="pin_bulletin" className="text-[11px] font-black uppercase text-slate-300 flex items-center gap-1 cursor-pointer">
                <Pin className="w-3.5 h-3.5 text-amber-500" /> Pin bulletin at top of dashboards
              </label>
            </div>

            {/* Scheduled At */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-500" /> Schedule Publication (Optional)
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-400 outline-none focus:border-amber-500"
              />
            </div>

            {/* Expires At */}
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" /> Set Expiration date (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-400 outline-none focus:border-amber-500"
              />
            </div>

          </div>

          {/* Bulletin Content Textarea */}
          <div className="space-y-1.5">
            <label className="text-[10px] text-slate-400 uppercase font-black tracking-wide">Bulletin content markup</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Type your official announcement here. Keep it clear, informative, and detailed..."
              className="w-full bg-slate-950 border border-slate-850 text-xs rounded-xl p-2.5 text-slate-100 outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetForm}
              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-amber-500 hover:brightness-110 text-slate-950 font-black text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <Check className="w-4 h-4" /> {editingId ? 'Update Bulletin Node' : 'Publish Bulletin Node'}
            </button>
          </div>

        </form>
      )}

      {/* ANNOUNCEMENTS GRID LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {announcements.map(a => (
          <div key={a.id} className="bg-slate-900 border border-slate-850 p-5 rounded-3xl flex flex-col justify-between hover:border-slate-800 transition">
            
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${getCategoryColor(a.category)}`}>
                    {a.category.replace('_', ' ')}
                  </span>
                  <span className="text-[9px] bg-slate-950 border border-slate-850 text-slate-400 px-1.5 py-0.5 rounded font-mono uppercase">
                    Audience: {a.targetAudience}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleTogglePin(a.id, a.pinned)}
                    className={`p-1.5 rounded-lg border transition ${
                      a.pinned 
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' 
                        : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-slate-300'
                    }`}
                    title={a.pinned ? 'Pinned at top' : 'Pin to top'}
                  >
                    <Pin className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleEditClick(a)}
                    className="p-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 rounded-lg transition"
                    title="Edit announcement"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteAnnouncement(a.id)}
                    className="p-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-rose-500 rounded-lg transition"
                    title="Delete announcement"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <h5 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
                  {a.pinned && <span className="text-amber-500 text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded font-black">PINNED</span>}
                  {a.title}
                </h5>
                <p className="text-[11px] text-slate-400 leading-relaxed whitespace-pre-wrap">{a.content}</p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-850/60 flex justify-between items-center text-[9px] text-slate-500 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                Created: {new Date(a.createdAt).toLocaleDateString()}
              </span>
              
              {a.expiresAt && (
                <span className="text-rose-400/80">
                  Expires: {new Date(a.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>

          </div>
        ))}

        {announcements.length === 0 && (
          <div className="col-span-1 md:col-span-2 bg-slate-900 border border-slate-850 p-12 text-center rounded-3xl text-slate-500 text-xs font-mono">
            No announcements published. Use the "Create Bulletin" button to broadcast instructions.
          </div>
        )}
      </div>

    </div>
  );
}
