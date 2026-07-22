import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { 
  Bike, 
  Phone, 
  Lock, 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  Upload, 
  Check, 
  Info, 
  CreditCard, 
  User, 
  ShieldCheck, 
  RefreshCw,
  Sparkles,
  X,
  ArrowRight,
  ClipboardCheck,
  Clipboard
} from 'lucide-react';
import { Rider } from '../types';
import { getActiveCity } from '../services/mapService';

interface RiderRegistrationFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function RiderRegistrationForm({ onClose, onSuccess }: RiderRegistrationFormProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  
  // Auto-generated credentials
  const [riderId, setRiderId] = useState<string>('');
  const [tempPassword, setTempPassword] = useState<string>('');
  const [securityPin, setSecurityPin] = useState<string>(''); // last 4 digits of temp password / Aadhaar
  
  // Copy feedback states
  const [copiedId, setCopiedId] = useState<boolean>(false);
  const [copiedPass, setCopiedPass] = useState<boolean>(false);

  // Input States
  const [fullName, setFullName] = useState<string>('');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [addressLine, setAddressLine] = useState<string>('');
  
  const [vehicleType, setVehicleType] = useState<string>('Motorcycle');
  const [vehicleNumber, setVehicleNumber] = useState<string>('');
  const [drivingLicence, setDrivingLicence] = useState<string>('');
  const [rcNumber, setRcNumber] = useState<string>('');
  const [aadhaarNumber, setAadhaarNumber] = useState<string>('');
  const [panNumber, setPanNumber] = useState<string>('');

  const [bankName, setBankName] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifscCode, setIfscCode] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');

  // Base64 document states
  const [docSelfie, setDocSelfie] = useState<string>('');
  const [docAadhaarFront, setDocAadhaarFront] = useState<string>('');
  const [docAadhaarBack, setDocAadhaarBack] = useState<string>('');
  const [docPAN, setDocPAN] = useState<string>('');
  const [docDL, setDocDL] = useState<string>('');
  const [docRC, setDocRC] = useState<string>('');

  // Helper to generate a secure random set of credentials
  const generateCredentials = () => {
    // Rider ID format: TTRXXXX (4 random digits)
    const randomDigits = Math.floor(1000 + Math.random() * 9000).toString();
    const newId = `TTR${randomDigits}`;
    
    // Strong Temporary Password containing 4 random digits at the end
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    let randStr = '';
    for (let i = 0; i < 4; i++) {
      randStr += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const newPass = `TTB@${randStr}${pin}`;
    
    setRiderId(newId);
    setTempPassword(newPass);
    setSecurityPin(pin); // This will serve as the 4-digit security PIN if Aadhaar is left blank
  };

  // Generate on mount
  useEffect(() => {
    generateCredentials();
  }, []);

  // Copy helper with iframe compatibility
  const handleCopy = async (text: string, type: 'id' | 'pass') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
      }
    } catch (err) {
      // robust fallback for browsers block clipboard API inside sandbox iframe
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      if (type === 'id') {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      } else {
        setCopiedPass(true);
        setTimeout(() => setCopiedPass(false), 2000);
      }
    }
  };



  // Convert files to base64 securely
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Maximum file limit is 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Main high-speed submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // If Aadhaar is provided, use its last 4 digits for pin. If empty/partial, use our auto-generated PIN to allow login.
      let finalAadhaar = aadhaarNumber.trim();
      let finalPin = securityPin;
      
      if (finalAadhaar.length >= 4) {
        finalPin = finalAadhaar.slice(-4);
      } else {
        // If Aadhaar is omitted, write a valid placeholder ending with our generated pin so they can log in instantly
        finalAadhaar = `Aadhaar-NotUploaded-${finalPin}`;
      }

      const riderPayload: Rider = {
        id: riderId,
        name: fullName.trim() || 'Unnamed Rider Partner',
        phone: phoneNumber.trim() || `unregistered_${Date.now()}`,
        email: email.trim() || `${riderId.toLowerCase()}@tingtong.com`,
        status: 'approved', // INSTANT APPROVAL!
        onlineStatus: 'offline',
        dutyStatus: 'off_duty',
        rating: 5.0,
        walletBalance: 0,
        drivingLicence: drivingLicence.trim() || 'DL-PENDING',
        rcNumber: rcNumber.trim() || 'RC-PENDING',
        aadhaarNumber: finalAadhaar,
        panNumber: panNumber.trim() || 'PAN-PENDING',
        bankName: bankName.trim() || 'NOT_PROVIDED',
        accountNumber: accountNumber.trim() || 'NOT_PROVIDED',
        ifscCode: ifscCode.trim() || 'NOT_PROVIDED',
        upiId: uppiIdResolver(upiId, phoneNumber),
        attendanceDays: 0,
        totalPenalties: 0,
        totalIncentives: 0,
        address: addressLine.trim() || `${getActiveCity().name} Address Pending`,
        city: getActiveCity().name,
        state: 'Madhya Pradesh',
        pinCode: '462001',
        dob: '1995-01-01',
        emergencyContact: 'Emergency - Contact Admin',
        vehicleType: vehicleType,
        vehicleNumber: vehicleNumber.trim() || 'MP-04-PENDING',
        codLimit: 5000,
        aadhaarFrontUrl: docAadhaarFront || '',
        aadhaarBackUrl: docAadhaarBack || '',
        panCardUrl: docPAN || '',
        drivingLicenceUrl: docDL || '',
        rcUrl: docRC || '',
        profilePhotoUrl: docSelfie || '',
        liveSelfieUrl: docSelfie || ''
      };

      // Direct write to Firebase
      await setDoc(doc(db, 'riders', riderId), riderPayload);

      setSuccessMsg(`🎉 Rider ${riderId} Registered & APPROVED instantly! Credentials are ready to share.`);
      
      // Keep successful modal open for copy/verification or trigger onSuccess callback after a short delay
      setTimeout(() => {
        onSuccess();
      }, 4000);

    } catch (err: any) {
      setError(`Database persistent save failure: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const uppiIdResolver = (customUpi: string, phone: string) => {
    if (customUpi.trim()) return customUpi.trim();
    if (phone.trim()) return `${phone.trim()}@paytm`;
    return 'pending@upi';
  };

  return (
    <form 
      onSubmit={handleSubmit} 
      className="bg-slate-900 border border-slate-800 rounded-3xl relative max-w-2xl w-full mx-auto shadow-2xl selection:bg-amber-500 selection:text-slate-950 overflow-hidden text-slate-100 flex flex-col max-h-[92vh] sm:max-h-[88vh] md:max-h-[85vh] my-auto"
    >
      {/* Absolute top neon decorative accent */}
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 z-10"></div>

      {/* Header Row (Fixed at Top) */}
      <div className="flex items-center justify-between border-b border-slate-800 p-4 sm:p-6 pb-3 shrink-0">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-amber-500 flex items-center gap-2">
            <Bike className="w-5 h-5 shrink-0" />
            <span>Quick Rider Registration (Admin Mode)</span>
          </h2>
          <p className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
            ⚡ Blazing-fast, free-form registry panel with auto-capitalization & instant approval.
          </p>
        </div>
        <button 
          type="button"
          onClick={onClose}
          className="p-1.5 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-slate-100 transition duration-250 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable Body Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 min-h-0 scrollbar-thin scrollbar-thumb-slate-800">
        
        {/* Auto Credentials Card Box */}
        <div className="bg-slate-950 border border-slate-850 p-3.5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-200">System Generated Credentials</span>
            </div>
            <button
              type="button"
              onClick={generateCredentials}
              className="text-[10px] font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1 cursor-pointer transition"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Regenerate</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* Rider ID */}
            <div className="bg-slate-900/60 p-2.5 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Rider ID (Unique)</span>
                <span className="font-mono text-sm font-black text-amber-400">{riderId || 'Generating...'}</span>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(riderId, 'id')}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-amber-500/20 text-[10px] font-bold text-slate-300 rounded-lg flex items-center gap-1 transition"
              >
                {copiedId ? <ClipboardCheck className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                <span>{copiedId ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Temporary Password & Security PIN */}
            <div className="bg-slate-900/60 p-2.5 border border-slate-800 rounded-xl flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold text-slate-500 block">Temp Password & PIN</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-sm font-black text-slate-100">{tempPassword || 'Generating...'}</span>
                  <span className="bg-amber-500/10 text-amber-400 px-1 py-0.5 rounded text-[9px] font-bold font-mono">PIN: {securityPin}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(tempPassword, 'pass')}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 hover:border-amber-500/20 text-[10px] font-bold text-slate-300 rounded-lg flex items-center gap-1 transition"
              >
                {copiedPass ? <ClipboardCheck className="w-3 h-3 text-emerald-400" /> : <Clipboard className="w-3 h-3" />}
                <span>{copiedPass ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="text-[9px] text-slate-400 bg-slate-900/40 p-2 rounded-lg border border-slate-800/40">
            💡 <span className="font-bold text-amber-500">How to login:</span> The rider can log in on the app using their registered Phone Number and the 4-digit Security PIN <span className="font-mono text-slate-200">({securityPin})</span>. No password memorization required!
          </div>
        </div>

        {/* Global notifications */}
        {successMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs flex items-center gap-2.5 animate-pulse">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <span className="font-bold">{successMsg}</span>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-xs flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Action shortcuts notice */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-950 px-3 py-2 border border-slate-850 rounded-xl text-xs">
          <span className="text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span>No fields are mandatory. Submit blank or partially-filled.</span>
          </span>
        </div>

        {/* SECTION 1: Personal Profile Info */}
        <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl space-y-3">
          <h3 className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-amber-500" />
            <span>1. Personal & Identity info</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Full name */}
            <div className="space-y-1">
              <label htmlFor="admin_rider_name" className="text-[10px] font-bold text-slate-400">Full Name</label>
              <input 
                id="admin_rider_name"
                tabIndex={1}
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Sandeep Rajvanshi"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
              />
            </div>

            {/* Mobile Phone */}
            <div className="space-y-1">
              <label htmlFor="admin_rider_phone" className="text-[10px] font-bold text-slate-400">Mobile Phone</label>
              <input 
                id="admin_rider_phone"
                tabIndex={2}
                type="tel"
                maxLength={10}
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="10-digit number"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="admin_rider_email" className="text-[10px] font-bold text-slate-400">Email Address</label>
              <input 
                id="admin_rider_email"
                tabIndex={3}
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
              />
            </div>

            {/* Local Address */}
            <div className="sm:col-span-3 space-y-1">
              <label htmlFor="admin_rider_address" className="text-[10px] font-bold text-slate-400">Local Address ({getActiveCity().name})</label>
              <input 
                id="admin_rider_address"
                tabIndex={4}
                type="text"
                value={addressLine}
                onChange={e => setAddressLine(e.target.value)}
                placeholder={`Street address, colony, landmark in ${getActiveCity().name}`}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Vehicle & Id Cards Info */}
        <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl space-y-3">
          <h3 className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
            <Bike className="w-3.5 h-3.5 text-amber-500" />
            <span>2. Vehicle & Government IDs</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Vehicle Type */}
            <div className="space-y-1">
              <label htmlFor="admin_vehicle_type" className="text-[10px] font-bold text-slate-400">Vehicle Type</label>
              <select 
                id="admin_vehicle_type"
                tabIndex={5}
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
              >
                <option value="Motorcycle">Motorcycle (पेट्रोल)</option>
                <option value="Scooter">Scooter (स्कूटी)</option>
                <option value="Electric Cycle">Electric Cycle</option>
                <option value="Auto Rickshaw">Auto Rickshaw</option>
              </select>
            </div>

            {/* Vehicle Number - AUTO UPPERCASE */}
            <div className="space-y-1">
              <label htmlFor="admin_vehicle_num" className="text-[10px] font-bold text-slate-400">Vehicle Number</label>
              <input 
                id="admin_vehicle_num"
                tabIndex={6}
                type="text"
                value={vehicleNumber}
                onChange={e => setVehicleNumber(e.target.value.toUpperCase())}
                placeholder="MP04AB1234"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>

            {/* Driving License */}
            <div className="space-y-1">
              <label htmlFor="admin_dl" className="text-[10px] font-bold text-slate-400">Driving License ID</label>
              <input 
                id="admin_dl"
                tabIndex={7}
                type="text"
                value={drivingLicence}
                onChange={e => setDrivingLicence(e.target.value.toUpperCase())}
                placeholder="MP04 202..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>

            {/* Aadhaar Number */}
            <div className="space-y-1">
              <label htmlFor="admin_aadhaar" className="text-[10px] font-bold text-slate-400">Aadhaar (12 Digits)</label>
              <input 
                id="admin_aadhaar"
                tabIndex={8}
                type="text"
                maxLength={12}
                value={aadhaarNumber}
                onChange={e => setAadhaarNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Card Number"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>

            {/* PAN Number - AUTO UPPERCASE */}
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <label htmlFor="admin_pan" className="text-[10px] font-bold text-slate-400">PAN ID Number</label>
              <input 
                id="admin_pan"
                tabIndex={9}
                type="text"
                maxLength={10}
                value={panNumber}
                onChange={e => setPanNumber(e.target.value.toUpperCase())}
                placeholder="ABCDE1234F"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: Bank Details */}
        <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl space-y-3">
          <h3 className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-amber-500" />
            <span>3. Bank Settlement Info</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {/* Bank Name */}
            <div className="sm:col-span-2 space-y-1">
              <label htmlFor="admin_bank_name" className="text-[10px] font-bold text-slate-400">Bank Name</label>
              <input 
                id="admin_bank_name"
                tabIndex={10}
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder="e.g. SBI, HDFC, ICICI"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition"
              />
            </div>

            {/* Account Number */}
            <div className="space-y-1">
              <label htmlFor="admin_bank_acc" className="text-[10px] font-bold text-slate-400">Account Number</label>
              <input 
                id="admin_bank_acc"
                tabIndex={11}
                type="text"
                value={accountNumber}
                onChange={e => setAccountNumber(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="Account No"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>

            {/* IFSC Code */}
            <div className="space-y-1">
              <label htmlFor="admin_ifsc" className="text-[10px] font-bold text-slate-400">IFSC Code</label>
              <input 
                id="admin_ifsc"
                tabIndex={12}
                type="text"
                value={ifscCode}
                onChange={e => setIfscCode(e.target.value.toUpperCase())}
                placeholder="SBIN00..."
                className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs text-slate-100 focus:border-amber-500 outline-none transition font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: Document Attachments */}
        <div className="bg-slate-950 p-3 border border-slate-850 rounded-2xl space-y-3">
          <h3 className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
            <span>4. Document Uploads (Optional)</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
            
            {/* Profile Selfie */}
            <div className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-2 text-center text-xs h-16 flex flex-col items-center justify-center transition cursor-pointer">
              {docSelfie ? (
                <div className="relative w-full h-full">
                  <img src={docSelfie} className="w-full h-full object-contain rounded" alt="Selfie" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDocSelfie(''); }} className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-0.5 text-white"><X className="w-2 h-2" /></button>
                </div>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold">Profile Photo</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocSelfie)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            {/* Aadhaar Front */}
            <div className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-2 text-center text-xs h-16 flex flex-col items-center justify-center transition cursor-pointer">
              {docAadhaarFront ? (
                <div className="relative w-full h-full">
                  <img src={docAadhaarFront} className="w-full h-full object-contain rounded" alt="Aadhaar Front" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDocAadhaarFront(''); }} className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-0.5 text-white"><X className="w-2 h-2" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold">Aadhaar Front</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocAadhaarFront)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            {/* Aadhaar Back */}
            <div className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-2 text-center text-xs h-16 flex flex-col items-center justify-center transition cursor-pointer">
              {docAadhaarBack ? (
                <div className="relative w-full h-full">
                  <img src={docAadhaarBack} className="w-full h-full object-contain rounded" alt="Aadhaar Back" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDocAadhaarBack(''); }} className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-0.5 text-white"><X className="w-2 h-2" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold">Aadhaar Back</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocAadhaarBack)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            {/* PAN Card */}
            <div className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-2 text-center text-xs h-16 flex flex-col items-center justify-center transition cursor-pointer">
              {docPAN ? (
                <div className="relative w-full h-full">
                  <img src={docPAN} className="w-full h-full object-contain rounded" alt="PAN Doc" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDocPAN(''); }} className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-0.5 text-white"><X className="w-2 h-2" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold">PAN Card</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocPAN)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            {/* DL Document */}
            <div className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-2 text-center text-xs h-16 flex flex-col items-center justify-center transition cursor-pointer">
              {docDL ? (
                <div className="relative w-full h-full">
                  <img src={docDL} className="w-full h-full object-contain rounded" alt="DL Doc" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDocDL(''); }} className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-0.5 text-white"><X className="w-2 h-2" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold">DL License</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocDL)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

            {/* RC Document */}
            <div className="relative bg-slate-900 border border-slate-800 hover:border-amber-500/30 rounded-xl p-2 text-center text-xs h-16 flex flex-col items-center justify-center transition cursor-pointer">
              {docRC ? (
                <div className="relative w-full h-full">
                  <img src={docRC} className="w-full h-full object-contain rounded" alt="RC Doc" />
                  <button type="button" onClick={(e) => { e.stopPropagation(); setDocRC(''); }} className="absolute -top-1 -right-1 bg-rose-600 rounded-full p-0.5 text-white"><X className="w-2 h-2" /></button>
                </div>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-slate-400 mb-1" />
                  <span className="text-[9px] text-slate-400 font-bold">RC Book</span>
                </>
              )}
              <input type="file" accept="image/*" onChange={e => handleFileChange(e, setDocRC)} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>

          </div>
        </div>

      </div>

      {/* Action Panel Footer (Fixed at Bottom) */}
      <div className="flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3 p-4 sm:p-6 pt-3 border-t border-slate-800 bg-slate-950/40 backdrop-blur-sm shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold rounded-xl text-xs transition text-center cursor-pointer"
        >
          Cancel
        </button>
        
        <button
          type="submit"
          disabled={loading}
          tabIndex={13}
          className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black rounded-xl text-xs hover:brightness-110 hover:scale-[1.01] active:scale-[0.99] transition flex items-center justify-center gap-2 shadow-lg shadow-amber-900/20 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Registering Approved Rider...</span>
            </>
          ) : (
            <>
              <Check className="w-4 h-4" />
              <span>Register & Approve Rider Instantly</span>
            </>
          )}
        </button>
      </div>

    </form>
  );
}
