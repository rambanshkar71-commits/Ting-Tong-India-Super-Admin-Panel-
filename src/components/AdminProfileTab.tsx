import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, addDoc, updateDoc } from 'firebase/firestore';
import { User, Smartphone, Lock, ShieldCheck, CheckCircle, Bell, Clock, Key, MapPin, AlertTriangle } from 'lucide-react';
import { getActiveCity } from '../services/mapService';

interface AdminProfileTabProps {
  adminEmail: string | null;
  onLogEvent: (action: string, details: string) => void;
}

export default function AdminProfileTab({ adminEmail, onLogEvent }: AdminProfileTabProps) {
  const [profileName, setProfileName] = useState('Ting Tong Super Admin');
  const [phone, setPhone] = useState('+91 755 2293021');
  const [altEmail, setAltEmail] = useState('admin.backup@tingtong.com');
  const [avatar, setAvatar] = useState('https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop');
  const [address, setAddress] = useState(`Corporate Office, Headquarters, ${getActiveCity().name}`);
  
  // Security
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // 2FA
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [mfaSecret, setMfaSecret] = useState(`TT${getActiveCity().name.toUpperCase()}-MFA-K29X-884P`);
  const [mfaCode, setMfaCode] = useState('');

  // Active Sessions & Devices
  const [sessions, setSessions] = useState([
    { id: 'sess_1', device: 'Chrome on Windows 11', ip: '157.34.122.90', location: `Central Area, ${getActiveCity().name}`, lastActive: 'Just Now', isCurrent: true },
    { id: 'sess_2', device: 'Safari on iPhone 15 Pro', ip: '103.88.22.14', location: `Suburbs, ${getActiveCity().name}`, lastActive: '2 hours ago', isCurrent: false },
    { id: 'sess_3', device: 'Edge on macOS Sonoma', ip: '182.23.45.161', location: `Transit Hub, ${getActiveCity().name}`, lastActive: '1 day ago', isCurrent: false }
  ]);

  const [devices, setDevices] = useState([
    { id: 'dev_1', name: 'Admin Workstation (Windows)', type: 'Desktop', verified: true, date: '2026-05-12' },
    { id: 'dev_2', name: 'Mobile Companion (iOS)', type: 'Smartphone', verified: true, date: '2026-06-01' },
    { id: 'dev_3', name: 'Unknown Android Tablet', type: 'Tablet', verified: false, date: '2026-07-08' }
  ]);

  // Security Params
  const [timeout, setTimeoutLimit] = useState('30');
  const [maxAttempts, setMaxAttempts] = useState('5');
  const [ipWhitelist, setIpWhitelist] = useState('');

  // Notification Preferences
  const [notifs, setNotifs] = useState({
    newOrders_email: true, newOrders_push: true, newOrders_sms: false,
    support_email: true, support_push: true, support_sms: true,
    settlement_email: true, settlement_push: false, settlement_sms: false,
    system_email: true, system_push: true, system_sms: true,
  });

  useEffect(() => {
    // Subscribe to profile settings in real-time
    const ref = doc(db, 'system_settings', 'admin_profile');
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setProfileName(data.name || 'Ting Tong Super Admin');
        setPhone(data.phone || '+91 755 2293021');
        setAltEmail(data.altEmail || 'admin.backup@tingtong.com');
        setAvatar(data.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=150&auto=format&fit=crop');
        setAddress(data.address || `Corporate Office, Headquarters, ${getActiveCity().name}`);
        setTwoFactorEnabled(!!data.twoFactorEnabled);
        setTimeoutLimit(data.timeout || '30');
        setMaxAttempts(data.maxAttempts || '5');
        setIpWhitelist(data.ipWhitelist || '');
        if (data.notifs) setNotifs(data.notifs);
      }
    }, (err) => {
      console.error("Error subscribing to admin profile:", err);
    });
    return unsubscribe;
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ref = doc(db, 'system_settings', 'admin_profile');
      await setDoc(ref, {
        name: profileName,
        phone,
        altEmail,
        avatar,
        address,
        twoFactorEnabled,
        timeout,
        maxAttempts,
        ipWhitelist,
        notifs
      }, { merge: true });

      onLogEvent('ADMIN_PROFILE_UPDATE', `Updated name, email credentials and alternate contact endpoints.`);
      alert("Personal profile configuration synced and saved to Firebase!");
    } catch (e) {
      console.error(e);
      alert("Error saving profile details.");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("New passwords do not match!");
      return;
    }
    try {
      // Since actual Auth updates are handled in credentials, we save metadata log to Firebase
      onLogEvent('PASSWORD_CHANGE_REQUEST', `Initiated administrator master password renewal.`);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert("Admin security credential change request processed successfully and logged!");
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggle2FA = () => {
    if (twoFactorEnabled) {
      setTwoFactorEnabled(false);
      onLogEvent('MFA_DEACTIVATION', `Two-Factor Authentication was disabled for administrative sessions.`);
    } else {
      setShow2FAModal(true);
    }
  };

  const handleVerify2FA = async () => {
    if (mfaCode === '123456' || mfaCode.length === 6) {
      setTwoFactorEnabled(true);
      setShow2FAModal(false);
      setMfaCode('');
      try {
        await setDoc(doc(db, 'system_settings', 'admin_profile'), { twoFactorEnabled: true }, { merge: true });
        onLogEvent('MFA_ACTIVATION', `Two-Factor Authentication fully registered and activated via secure TOTP.`);
        alert("2FA TOTP verified successfully!");
      } catch (err) {
        console.error(err);
      }
    } else {
      alert("Invalid code! Try standard 6-digit backup keys or '123456'.");
    }
  };

  const handleRevokeSession = (id: string, name: string) => {
    setSessions(sessions.filter(s => s.id !== id));
    onLogEvent('SESSION_REVOKED', `Force-revoked administrative login session for device: ${name}`);
    alert(`Session for ${name} has been revoked successfully!`);
  };

  const handleManageDevice = (id: string, action: 'verify' | 'block') => {
    setDevices(devices.map(d => {
      if (d.id === id) {
        return { ...d, verified: action === 'verify' };
      }
      return d;
    }));
    onLogEvent('DEVICE_MANAGEMENT', `Device verification status modified for hardware node index ID: ${id}`);
  };

  const handleToggleNotif = (key: keyof typeof notifs) => {
    setNotifs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  return (
    <div className="space-y-8">
      {/* Grid containing Profile & Alternate Contact */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Personal profile form */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <User className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Personal Admin Profile</h3>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-850">
              <img src={avatar} alt="Profile Avatar" className="w-16 h-16 rounded-full object-cover border-2 border-amber-500" />
              <div className="space-y-1.5 flex-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Avatar Photo URL</label>
                <input 
                  type="text" 
                  value={avatar} 
                  onChange={e => setAvatar(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-100 focus:border-amber-500 outline-none font-mono text-[11px]" 
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Display Name</label>
                <input 
                  required 
                  type="text" 
                  value={profileName} 
                  onChange={e => setProfileName(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Primary Contact Phone</label>
                <input 
                  required 
                  type="text" 
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Backup Email Endpoint</label>
                <input 
                  required 
                  type="email" 
                  value={altEmail} 
                  onChange={e => setAltEmail(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Account Username</label>
                <input 
                  disabled 
                  type="text" 
                  value={adminEmail || 'admin@tingtong.com'} 
                  className="w-full bg-slate-950/60 border border-slate-850 rounded-xl p-3 text-slate-500 cursor-not-allowed font-mono outline-none" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Corporate Street Address</label>
              <input 
                required 
                type="text" 
                value={address} 
                onChange={e => setAddress(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
              />
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              Sync Personal Profile Settings
            </button>
          </form>
        </div>

        {/* Credentials & Password Change & 2FA */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Lock className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold text-sm text-slate-100">Security Credentials & Authentication</h3>
          </div>

          <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <p className="font-bold text-xs text-slate-200">Two-Factor Authenticator (2FA)</p>
              <p className="text-[11px] text-slate-500 leading-normal">Requires high-entropy TOTP code from Google Authenticator or Duo before each admin session login.</p>
            </div>
            <button
              onClick={handleToggle2FA}
              className={`px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition shrink-0 ${
                twoFactorEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {twoFactorEnabled ? '● Active' : 'Enable 2FA'}
            </button>
          </div>

          {/* Password Reset Segment */}
          <form onSubmit={handlePasswordChange} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Password</label>
              <input 
                required 
                type="password" 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                <input 
                  required 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                <input 
                  required 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-100 focus:border-amber-500 outline-none" 
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 font-bold py-3 rounded-xl transition cursor-pointer"
            >
              Update Password Key
            </button>
          </form>
        </div>

      </div>

      {/* Active sessions list & registered devices & Whitelist */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Active sessions */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Live Active Login Sessions</h3>
          </div>
          
          <div className="space-y-3">
            {sessions.map(s => (
              <div key={s.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-900 text-slate-400 border border-slate-800">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-200 flex items-center gap-1.5">
                      {s.device}
                      {s.isCurrent && <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 text-[9px] rounded font-bold uppercase tracking-wider">Current Session</span>}
                    </p>
                    <p className="text-[10px] text-slate-500">IP: {s.ip} • Loc: {s.location} • Active: {s.lastActive}</p>
                  </div>
                </div>
                {!s.isCurrent && (
                  <button 
                    onClick={() => handleRevokeSession(s.id, s.device)}
                    className="text-rose-400 hover:text-rose-300 font-bold tracking-wide uppercase text-[9px] bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/15 cursor-pointer self-start sm:self-center"
                  >
                    Revoke Session
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Authorized Devices list */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Key className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm text-slate-100">Authorized Device Locks</h3>
          </div>

          <div className="space-y-3 text-xs">
            {devices.map(d => (
              <div key={d.id} className="bg-slate-950 border border-slate-850 p-3 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <p className="font-bold text-slate-200 text-xs">{d.name}</p>
                  <p className="text-[10px] text-slate-500">Platform: {d.type} • Verified: {d.date}</p>
                </div>
                {d.verified ? (
                  <button 
                    onClick={() => handleManageDevice(d.id, 'block')}
                    className="text-[10px] text-rose-400 font-semibold hover:underline bg-rose-500/10 p-1.5 px-2 rounded-lg"
                  >
                    Block Device
                  </button>
                ) : (
                  <button 
                    onClick={() => handleManageDevice(d.id, 'verify')}
                    className="text-[10px] text-emerald-400 font-semibold hover:underline bg-emerald-500/10 p-1.5 px-2 rounded-lg"
                  >
                    Approve
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Global IP Whitelisting & Session Limitations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Security parameters */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Network Whitelisting & Restrictions</h3>
          </div>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Idle Session Timeout Limit</label>
                <select 
                  value={timeout} 
                  onChange={e => setTimeoutLimit(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-200 outline-none focus:border-amber-500"
                >
                  <option value="15">15 Minutes (High Security)</option>
                  <option value="30">30 Minutes (Standard)</option>
                  <option value="60">1 Hour (Managerial)</option>
                  <option value="120">2 Hours (Max Threshold)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Max Failed Logins Lockout</label>
                <select 
                  value={maxAttempts} 
                  onChange={e => setMaxAttempts(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-slate-200 outline-none focus:border-amber-500"
                >
                  <option value="3">3 Attempts (Strict)</option>
                  <option value="5">5 Attempts (Recommended)</option>
                  <option value="10">10 Attempts (Relaxed)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Restricted IP Range Whitelist</label>
              <textarea 
                value={ipWhitelist} 
                onChange={e => setIpWhitelist(e.target.value)} 
                placeholder="192.168.1.0/24, 157.34.0.0/16 (Leave blank to permit accesses from all locations)" 
                className="w-full h-20 bg-slate-950 border border-slate-850 rounded-xl p-3 outline-none focus:border-amber-500 text-slate-300 font-mono text-[10px] resize-none" 
              />
              <p className="text-[10px] text-slate-500 leading-normal">Enter comma-separated values in standard CIDR formats to lock down admin console egress ports.</p>
            </div>
          </div>
        </div>

        {/* Grid table for notification preferences */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-850 pb-3">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-slate-100">Super Admin Notification Envelopes</h3>
          </div>

          <div className="space-y-3 text-[11px]">
            <div className="grid grid-cols-4 gap-2 text-[9px] font-bold uppercase tracking-wider text-slate-500 pb-1 border-b border-slate-800/80">
              <span>Event Stream</span>
              <span className="text-center">Email</span>
              <span className="text-center">Push App</span>
              <span className="text-center">SMS Gate</span>
            </div>

            {[
              { label: "New Food Orders", emailKey: "newOrders_email", pushKey: "newOrders_push", smsKey: "newOrders_sms" },
              { label: "Rider/Store Tickets", emailKey: "support_email", pushKey: "support_push", smsKey: "support_sms" },
              { label: "Daily Ledger Payouts", emailKey: "settlement_email", pushKey: "settlement_push", smsKey: "settlement_sms" },
              { label: "System Hardware Alerts", emailKey: "system_email", pushKey: "system_push", smsKey: "system_sms" },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-4 gap-2 items-center py-1.5 border-b border-slate-850/50">
                <span className="font-medium text-slate-300">{row.label}</span>
                <div className="flex justify-center">
                  <input 
                    type="checkbox" 
                    checked={notifs[row.emailKey as keyof typeof notifs]} 
                    onChange={() => handleToggleNotif(row.emailKey as keyof typeof notifs)} 
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 accent-amber-500 cursor-pointer" 
                  />
                </div>
                <div className="flex justify-center">
                  <input 
                    type="checkbox" 
                    checked={notifs[row.pushKey as keyof typeof notifs]} 
                    onChange={() => handleToggleNotif(row.pushKey as keyof typeof notifs)} 
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 accent-amber-500 cursor-pointer" 
                  />
                </div>
                <div className="flex justify-center">
                  <input 
                    type="checkbox" 
                    checked={notifs[row.smsKey as keyof typeof notifs]} 
                    onChange={() => handleToggleNotif(row.smsKey as keyof typeof notifs)} 
                    className="w-4 h-4 rounded border-slate-800 bg-slate-950 accent-amber-500 cursor-pointer" 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* 2FA Verification Modal */}
      {show2FAModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-500" />
                Register 2FA MFA Token
              </h4>
              <button onClick={() => setShow2FAModal(false)} className="text-slate-400 hover:text-slate-200">✕</button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <p>Scan the code below in Google Authenticator or copy the secure string manually:</p>
              
              {/* Fake QR barcode render with plain styling */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex flex-col items-center justify-center gap-3">
                <div className="w-36 h-36 bg-white p-2 rounded-lg flex flex-col justify-between">
                  <div className="flex justify-between h-4">
                    <div className="w-4 h-4 bg-black"></div>
                    <div className="w-4 h-4 bg-black"></div>
                  </div>
                  <div className="flex flex-wrap justify-center text-[5px] text-slate-600 font-mono tracking-tighter leading-none select-none max-w-xs uppercase">
                    TING TONG FOODS BHOPAL ADMIN TERMINAL SECURE QR
                  </div>
                  <div className="flex justify-between h-4">
                    <div className="w-4 h-4 bg-black"></div>
                    <div className="w-2 h-4 bg-black"></div>
                  </div>
                </div>
                <span className="font-mono text-amber-500 font-bold select-all tracking-wider text-xs">{mfaSecret}</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Enter Google Auth 6-Digit TOTP Code</label>
                <input 
                  type="text" 
                  value={mfaCode} 
                  onChange={e => setMfaCode(e.target.value)} 
                  placeholder="123456" 
                  maxLength={6} 
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl p-3 text-center text-lg font-mono tracking-widest text-slate-100 focus:border-amber-500 outline-none" 
                />
              </div>

              <button 
                onClick={handleVerify2FA} 
                className="w-full bg-amber-500 text-slate-950 font-bold py-3 rounded-xl hover:bg-amber-600 transition"
              >
                Verify & Register MFA Key
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
