import React, { useState, useRef } from 'react';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { processImageFile, uploadImageToStorage } from '../services/imageUploadService';
import LocationPickerMap from './LocationPickerMap';
import {
  Store,
  User,
  Mail,
  Phone,
  Percent,
  MapPin,
  Building2,
  CreditCard,
  Camera,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  FileCheck2,
  Loader2,
  ShieldCheck,
} from 'lucide-react';

interface MerchantOnboardingFormProps {
  onClose: () => void;
  onSuccess: (restaurantId: string) => void;
  gstMandatory?: boolean;
}

export default function MerchantOnboardingForm({
  onClose,
  onSuccess,
  gstMandatory = false,
}: MerchantOnboardingFormProps) {
  // Form input states
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [commission, setCommission] = useState('15');

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Bhopal');
  const [state, setState] = useState('Madhya Pradesh');
  const [pincode, setPincode] = useState('462001');
  const [lat, setLat] = useState(23.2599);
  const [lng, setLng] = useState(77.4126);

  const [gst, setGst] = useState('');
  const [fssai, setFssai] = useState('');

  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');

  // Image Upload States
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [coverDataUrl, setCoverDataUrl] = useState<string>('');
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [isProcessingCover, setIsProcessingCover] = useState(false);

  // Camera Capture modal
  const [cameraActiveField, setCameraActiveField] = useState<'logo' | 'cover' | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // File Inputs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Logo file handler
  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingLogo(true);
    try {
      const processed = await processImageFile(file, 400, 400, 0.85);
      setLogoDataUrl(processed.dataUrl);
    } catch (err) {
      console.error('Logo processing failed:', err);
      setErrorMsg('Failed to process logo image');
    } finally {
      setIsProcessingLogo(false);
    }
  };

  // Cover file handler
  const handleCoverSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingCover(true);
    try {
      const processed = await processImageFile(file, 1200, 600, 0.85);
      setCoverDataUrl(processed.dataUrl);
    } catch (err) {
      console.error('Cover processing failed:', err);
      setErrorMsg('Failed to process cover image');
    } finally {
      setIsProcessingCover(false);
    }
  };

  // Start Camera
  const startCamera = async (target: 'logo' | 'cover') => {
    setCameraActiveField(target);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Camera access error:', err);
      alert('Could not access camera device.');
      setCameraActiveField(null);
    }
  };

  // Capture Camera Frame
  const captureCameraFrame = async () => {
    if (!videoRef.current || !cameraActiveField) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    if (cameraActiveField === 'logo') {
      const processed = await processImageFile(new Blob([dataUrl]), 400, 400, 0.85);
      setLogoDataUrl(processed.dataUrl);
    } else {
      const processed = await processImageFile(new Blob([dataUrl]), 1200, 600, 0.85);
      setCoverDataUrl(processed.dataUrl);
    }

    stopCamera();
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraActiveField(null);
  };

  // Location Picker callback
  const handleLocationSelect = (loc: {
    lat: number;
    lng: number;
    address: string;
    city: string;
    state: string;
    pincode: string;
  }) => {
    setLat(loc.lat);
    setLng(loc.lng);
    setAddress(loc.address);
    setCity(loc.city);
    setState(loc.state);
    setPincode(loc.pincode);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // Validation
    if (!name.trim()) return setErrorMsg('Restaurant name is required');
    if (!ownerName.trim()) return setErrorMsg('Owner name is required');
    if (!email.trim() || !email.includes('@')) return setErrorMsg('Valid email address is required');
    if (!phone.trim() || phone.length < 10) return setErrorMsg('Valid 10-digit mobile number is required');
    if (!address.trim()) return setErrorMsg('Physical address is required');
    if (!fssai.trim()) return setErrorMsg('FSSAI License number is required');
    if (gstMandatory && !gst.trim()) return setErrorMsg('GSTIN Registration number is mandatory per Admin rules');
    if (!bankName.trim() || !accountHolderName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
      return setErrorMsg('All settlement bank account fields are required');
    }
    if (!upiId.trim()) return setErrorMsg('UPI ID is required');

    setIsSubmitting(true);

    try {
      const restaurantId = 'TTI_REST_' + Date.now();
      const code = 'TTI-REST-' + Math.floor(100000 + Math.random() * 900000);

      // Upload Images to Firebase Storage
      const defaultLogo =
        'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=300&auto=format&fit=crop';
      const defaultCover =
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1200&auto=format&fit=crop';

      const logoUrl = logoDataUrl
        ? await uploadImageToStorage(logoDataUrl, 'restaurantLogos', `${restaurantId}_logo.jpg`)
        : defaultLogo;
      const coverUrl = coverDataUrl
        ? await uploadImageToStorage(coverDataUrl, 'restaurantCovers', `${restaurantId}_cover.jpg`)
        : defaultCover;

      const now = new Date().toISOString();

      // Main Restaurant Document
      const restDoc = {
        id: restaurantId,
        restaurantCode: code,
        name: name.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        status: 'pending', // Pending Admin Verification & Auth Creation
        isOpen: true,
        rating: 5.0,
        commissionPercentage: Number(commission) || 15,
        gstNo: gst.trim() || 'GST-NOT-REGISTERED',
        fssaiNo: fssai.trim(),
        fssaiStatus: 'verified',
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: upiId.trim(),
        logoUrl,
        coverUrl,
        categories: ['Fast Food', 'North Indian', 'Street Food'],
        lat,
        lng,
        deliveryRadiusKm: 10,
        minOrderAmount: 99,
        packagingCharge: 15,
        gstMandatory,
        walletBalance: 0,
        menuLocked: false,
        loginDisabled: false,
        createdAt: now,
        updatedAt: now,
      };

      // Create multi-collection relational structure
      await setDoc(doc(db, 'restaurants', restaurantId), restDoc);

      await setDoc(doc(db, 'restaurantProfiles', restaurantId), {
        id: restaurantId,
        restaurantId,
        restaurantCode: code,
        name: name.trim(),
        ownerName: ownerName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        categories: restDoc.categories,
        logoUrl,
        coverUrl,
        rating: 5.0,
        status: 'pending',
        isOpen: true,
        createdAt: now,
        updatedAt: now,
      });

      await setDoc(doc(db, 'restaurantDocuments', restaurantId), {
        id: restaurantId,
        restaurantId,
        gstNo: restDoc.gstNo,
        gstStatus: gst.trim() ? 'verified' : 'pending',
        fssaiNo: fssai.trim(),
        fssaiStatus: 'verified',
        fssaiExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        verifiedAt: now,
      });

      await setDoc(doc(db, 'restaurantLocations', restaurantId), {
        id: restaurantId,
        restaurantId,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        lat,
        lng,
        isServiceable: true,
        deliveryRadiusKm: 10,
      });

      await setDoc(doc(db, 'restaurantBankDetails', restaurantId), {
        id: restaurantId,
        restaurantId,
        bankName: bankName.trim(),
        accountHolderName: accountHolderName.trim(),
        accountNumber: accountNumber.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        upiId: upiId.trim(),
        isVerified: true,
        verifiedAt: now,
      });

      onSuccess(restaurantId);
    } catch (err: any) {
      console.error('Error in merchant onboarding submission:', err);
      setErrorMsg(err.message || 'Failed to submit merchant registration');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 max-w-3xl w-full rounded-3xl overflow-hidden shadow-2xl my-auto animate-fade-in flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded-2xl text-orange-400">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100 tracking-tight">Merchant Onboarding Portal</h3>
              <p className="text-slate-400 text-xs">
                Register a new partner restaurant in Bhopal with full regulatory compliance.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-2 rounded-xl hover:bg-slate-900 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 text-slate-100">
          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3.5 rounded-2xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Identity */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <Store className="w-4 h-4" /> 1. Basic Restaurant Identity
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">* Mandatory Fields</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Restaurant Name *
                </label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Manohar Dairy & Restaurant"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none"
                  />
                  <Store className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Owner Name *</label>
                <div className="relative">
                  <input
                    required
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="e.g. Manohar Lal Harwani"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none"
                  />
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Email Address *
                </label>
                <div className="relative">
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. merchant@manohar.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Mobile Contact *
                </label>
                <div className="relative">
                  <input
                    required
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9826012345"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Platform Commission Rate (%) *
              </label>
              <div className="relative max-w-xs">
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={commission}
                  onChange={(e) => setCommission(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none font-mono font-bold"
                />
                <Percent className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>
          </div>

          {/* Section 2: Logo & Cover Image Upload */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" /> 2. Restaurant Branding & Photos
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Logo Upload Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Restaurant Logo
                  </label>
                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoDataUrl('')}
                      className="text-rose-400 text-[10px] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>

                {logoDataUrl ? (
                  <div className="relative h-28 rounded-xl overflow-hidden border border-slate-800 group">
                    <img src={logoDataUrl} alt="Logo Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 hover:border-orange-500/50 rounded-xl p-4 text-center space-y-2 transition">
                    <Store className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-[11px] text-slate-400 font-semibold">Upload Logo Image</p>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" /> Gallery
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera('logo')}
                        className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" /> Camera
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoSelect}
                />
              </div>

              {/* Cover Upload Box */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Restaurant Cover Photo
                  </label>
                  {coverDataUrl && (
                    <button
                      type="button"
                      onClick={() => setCoverDataUrl('')}
                      className="text-rose-400 text-[10px] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                </div>

                {coverDataUrl ? (
                  <div className="relative h-28 rounded-xl overflow-hidden border border-slate-800 group">
                    <img src={coverDataUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="bg-slate-800 text-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Replace
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-slate-800 hover:border-orange-500/50 rounded-xl p-4 text-center space-y-2 transition">
                    <ImageIcon className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-[11px] text-slate-400 font-semibold">Upload Cover Banner</p>
                    <div className="flex justify-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => coverInputRef.current?.click()}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <ImageIcon className="w-3 h-3" /> Gallery
                      </button>
                      <button
                        type="button"
                        onClick={() => startCamera('cover')}
                        className="bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Camera className="w-3 h-3" /> Camera
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverSelect}
                />
              </div>
            </div>
          </div>

          {/* Camera Capture Modal */}
          {cameraActiveField && (
            <div className="fixed inset-0 bg-slate-950/95 z-[60] flex flex-col items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden max-w-lg w-full p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h5 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <Camera className="w-4 h-4 text-orange-500" /> Capture {cameraActiveField} Photo
                  </h5>
                  <button type="button" onClick={stopCamera} className="text-slate-400 hover:text-slate-200">
                    ✕
                  </button>
                </div>
                <video ref={videoRef} className="w-full h-64 object-cover rounded-xl bg-black" />
                <button
                  type="button"
                  onClick={captureCameraFrame}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-slate-950 font-bold py-2.5 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4 fill-slate-950" /> Take Photo
                </button>
              </div>
            </div>
          )}

          {/* Section 3: Live Location & Geocoding */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> 3. Physical Address & GPS Location
              </h4>
            </div>

            <LocationPickerMap
              initialLat={lat}
              initialLng={lng}
              initialAddress={address}
              onLocationSelect={handleLocationSelect}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">State</label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pincode</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Licenses & Regulatory Documentation */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <FileCheck2 className="w-4 h-4" /> 4. Government Licenses & Taxation
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    GSTIN Registration Number {gstMandatory ? '*' : '(Optional)'}
                  </label>
                  {gstMandatory && (
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      Mandatory by Admin
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={gst}
                  onChange={(e) => setGst(e.target.value)}
                  placeholder="e.g. 23AABCT9384C1Z0"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  FSSAI License Number *
                </label>
                <input
                  required
                  type="text"
                  value={fssai}
                  onChange={(e) => setFssai(e.target.value)}
                  placeholder="14-Digit FSSAI License Number"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Banking & Settlement Credentials */}
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> 5. Banking & Payout Settlement Details
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bank Name *</label>
                <input
                  required
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account Holder Name *
                </label>
                <input
                  required
                  type="text"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                  placeholder="Name as printed in Bank passbook"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Account Number *
                </label>
                <input
                  required
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="e.g. 39485019284"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">IFSC Code *</label>
                <input
                  required
                  type="text"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                  placeholder="e.g. SBIN0001234"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Merchant UPI ID *</label>
              <input
                required
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="e.g. manohar@okaxis"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-100 focus:border-orange-500 outline-none font-mono"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Submitting Merchant Registration...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" /> Submit Merchant Application for Verification
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
