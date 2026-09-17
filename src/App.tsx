import React, { useState, useEffect, useRef } from 'react';
import { useApp, Barber } from './context/AppContext.tsx';
import { AdminConsole } from './AdminConsole';
import { 
  Scissors, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Star, 
  User, 
  ChevronRight,
  Sparkles,
  MapPin,
  Lock,
  Mail,
  LogOut,
  Sun,
  Moon,
  Compass,
  Search,
  Key,
  AlertTriangle,
  Plus,
  Trash,
  Edit,
  Building,
  Settings,
  Image,
  ChevronLeft
} from 'lucide-react';
import { gsap } from 'gsap';

// Pre-compiled local coordinates for Bhopal key neighborhoods to ensure resilient offline fallback geocoding
const LOCAL_BHOPAL_COORDS: Record<string, { lat: number; lon: number; display: string }> = {
  indrapuri: { lat: 23.2515, lon: 77.4660, display: 'Indrapuri, Bhopal' },
  jahangirabad: { lat: 23.2495, lon: 77.4172, display: 'Jinsi, Jahangirabad, Bhopal' },
  jinsi: { lat: 23.2495, lon: 77.4172, display: 'Jinsi, Jahangirabad, Bhopal' },
  'chaar batti': { lat: 23.2355, lon: 77.4150, display: 'Chaar Batti Choraha, Bhopal' },
  'mp nagar': { lat: 23.2315, lon: 77.4320, display: 'MP Nagar, Bhopal' },
  'arera colony': { lat: 23.2140, lon: 77.4350, display: 'Arera Colony, Bhopal' },
  bhel: { lat: 23.2475, lon: 77.4680, display: 'BHEL, Bhopal' },
  piplani: { lat: 23.2475, lon: 77.4680, display: 'Piplani, Bhopal' },
  'tt nagar': { lat: 23.2430, lon: 77.4010, display: 'TT Nagar, Bhopal' },
  'new market': { lat: 23.2430, lon: 77.4010, display: 'New Market, Bhopal' },
  'koh-e-fiza': { lat: 23.2660, lon: 77.3850, display: 'Koh-e-Fiza, Bhopal' },
  kolar: { lat: 23.1730, lon: 77.4190, display: 'Kolar Road, Bhopal' },
  lalghati: { lat: 23.2790, lon: 77.3630, display: 'Lalghati, Bhopal' }
};

const formatTime = (timeStr?: string) => {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length < 2) return timeStr;
  const hour = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(min)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const minutes = String(min).padStart(2, '0');
  return `${String(displayHour).padStart(2, '0')}:${minutes} ${ampm}`;
};

// ==========================================
// GOOGLE MAPS NAVIGATION REDIRECT
// ==========================================
interface NavigateButtonProps {
  appointment: any;
  barber: Barber;
  hideButton?: boolean;
}

const NavigateButton: React.FC<NavigateButtonProps> = ({ appointment, barber, hideButton }) => {
  const handleNavigate = () => {
    const getDirectionsUrl = (originLat: number, originLon: number) => {
      // Prefer barberMapsUrl from the appointment (fetched live from DB every 3s)
      // over barber.mapsUrl which may be stale from localStorage cache.
      let dest = (appointment as any)?.barberMapsUrl ||
                 appointment?.mapsUrl ||
                 (appointment as any)?.maps_url ||
                 barber?.mapsUrl || 
                 (barber as any)?.maps_url || '';

      // Try to parse query string from Google Maps URL
      if (dest.includes('query=')) {
        const match = dest.match(/[?&]query=([^&]+)/);
        if (match) {
          dest = decodeURIComponent(match[1]);
        }
      } else {
        // Try to parse coordinates in various formats
        const placeMatch = dest.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (placeMatch) {
          dest = `${placeMatch[1]},${placeMatch[2]}`;
        } else {
          const coordMatch = dest.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                             dest.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                             dest.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                             dest.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (coordMatch) {
            dest = `${coordMatch[1]},${coordMatch[2]}`;
          }
        }
      }

      // If no valid destination parsed from mapsUrl, fallback to name + location
      const name = barber?.name || appointment?.barberName;
      const loc = barber?.location || appointment?.location;
      if (!dest || dest.startsWith('http')) {
        if (name && loc) {
          dest = `${name} ${loc}`;
        } else if (barber?.lat && barber?.lon && (barber.lat !== 23.25 || barber.lon !== 77.41)) {
          dest = `${barber.lat},${barber.lon}`;
        } else if (appointment?.barberLat && appointment?.barberLon && (appointment.barberLat !== 23.25 || appointment.barberLon !== 77.41)) {
          dest = `${appointment.barberLat},${appointment.barberLon}`;
        } else {
          dest = dest || 'Looks Salon Bhopal';
        }
      }

      return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLon}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
    };

    const fallbackUserLat = appointment?.userLat || 23.2495;
    const fallbackUserLon = appointment?.userLon || 77.4172;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const url = getDirectionsUrl(lat, lon);
          window.open(url, '_blank');
        },
        (error) => {
          console.error("Error getting geolocation:", error);
          const url = getDirectionsUrl(fallbackUserLat, fallbackUserLon);
          window.open(url, '_blank');
        }
      );
    } else {
      const url = getDirectionsUrl(fallbackUserLat, fallbackUserLon);
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {!hideButton && (
        <button 
          type="button" 
          className="gold-glow-btn" 
          style={{ padding: '14px 20px', fontSize: '1rem', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '8px', width: '100%', cursor: 'pointer' }}
          onClick={handleNavigate}
        >
          <MapPin size={18} />
          Navigate to {barber.name} via Maps
        </button>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Est. Distance</span>
          <strong style={{ fontSize: '0.95rem', color: 'var(--accent-gold)' }}>
            {appointment.travelDistance !== undefined ? `${appointment.travelDistance}m` : `${barber.distanceMeters}m`}
          </strong>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Transit Time</span>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {appointment.travelEta !== undefined ? `${appointment.travelEta} min` : '8 min'}
          </strong>
        </div>
      </div>
    </div>
  );
};

interface ReviewPromptProps {
  app: any;
  submitReview: (appointmentId: string, barberId: string, rating: number, comment: string) => Promise<{ success: boolean; message: string }>;
  onSuccess?: (message: string) => void;
}

const ReviewPrompt: React.FC<ReviewPromptProps> = ({ app, submitReview, onSuccess }) => {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState('');

  return (
    <div className="glass-card gsap-card animate-slide-up" style={{ marginBottom: '36px', border: '1px solid var(--accent-gold-glow)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--accent-gold)' }}>
        <Sparkles size={20} />
        <h3 style={{ fontSize: '1.2rem', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Rate Your Experience</h3>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginBottom: '16px' }}>
        Your service at <strong>{app.barberName}</strong> is complete. Share your feedback to help others!
      </p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Rating</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <Star 
                  size={24} 
                  fill={star <= rating ? 'var(--accent-gold)' : 'transparent'} 
                  style={{ color: 'var(--accent-gold)' }} 
                />
              </button>
            ))}
          </div>
        </div>

        <div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase' }}>Write a Review</span>
          <textarea
            placeholder="Tell us about the service, cut quality, or styling experience..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{
              width: '100%',
              minHeight: '70px',
              padding: '12px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-light)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontSize: '0.9rem',
              resize: 'vertical'
            }}
          />
        </div>

        {msg && <p style={{ fontSize: '0.85rem', color: 'var(--status-green)', fontWeight: 600 }}>{msg}</p>}

        <button
          type="button"
          className="gold-glow-btn"
          disabled={submitting || !!msg}
          onClick={async () => {
            setSubmitting(true);
            const res = await submitReview(app.id, app.barberId, rating, comment);
            setSubmitting(false);
            if (res.success) {
              setMsg('Thank you for your feedback!');
              if (onSuccess) {
                onSuccess('Thank you! Review submitted successfully.');
              }
            }
          }}
          style={{ alignSelf: 'flex-start', padding: '10px 20px', fontSize: '0.85rem', justifyContent: 'center' }}
        >
          {submitting ? 'Submitting...' : msg ? 'Feedback Submitted ✓' : 'Submit Feedback'}
        </button>
      </div>
    </div>
  );
};

export default function App() {
  const { 
    currentUser,
    login,
    signup,
    logout,
    barbers, 
    services, 
    appointments, 
    bookAppointment,
    rescheduleAppointment,
    updateAppointmentStatus, 
    updateBarberDelay,
    startAppointmentWithOtp,
    completeAppointment,
    submitReview,
    setUserCoordinates,
    locationName,
    fetchLocalBarbers,
    resetBarbersToDefault,
    submitApplication,
    checkApplicationStatus,
    addBarberService,
    updateBarberService,
    deleteBarberService,
    updateBarberSettings,
    updateBarberProfileImage,
    addBarberPortfolioImage,
    deleteBarberPortfolioImage,
    updateBarberPortfolioOrder,
    sendOnboardingOtp,
    verifyOnboardingOtp,
    sendSignupOtp,
    sendResetPasswordOtp,
    resetPasswordWithOtp,
    changePassword,
    uploadImage
  } = useApp();

  const getLocalDateString = (d: Date = new Date()) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dateVal = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dateVal}`;
  };

  const isOtpVisible = (appDate: string, startTime: string) => {
    const [y, m, d] = appDate.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);
    const scheduledTime = new Date(y, m - 1, d, hours, minutes, 0);
    const now = new Date();
    const timeRemainingMinutes = (scheduledTime.getTime() - now.getTime()) / (60 * 1000);
    return timeRemainingMinutes <= 45;
  };

  const isCheckInWindowOpen = (appDate: string, startTime: string, endTime: string) => {
    const [y, m, d] = appDate.split('-').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const slotEndTime = new Date(y, m - 1, d, endH, endM, 0);
    const now = new Date();
    if (now.getTime() > slotEndTime.getTime()) {
      return false;
    }
    const [hours, minutes] = startTime.split(':').map(Number);
    const scheduledTime = new Date(y, m - 1, d, hours, minutes, 0);
    const diffMinutes = Math.abs(now.getTime() - scheduledTime.getTime()) / (60 * 1000);
    return diffMinutes <= 30;
  };

  const canReschedule = (appDate: string, startTime: string) => {
    const [y, m, d] = appDate.split('-').map(Number);
    const [hours, minutes] = startTime.split(':').map(Number);
    const scheduledTime = new Date(y, m - 1, d, hours, minutes, 0);
    const now = new Date();
    const timeDiffMinutes = (scheduledTime.getTime() - now.getTime()) / (60 * 1000);
    return timeDiffMinutes >= 5;
  };

  const sortUpcomingAppointments = (apps: any[]) => {
    return [...apps].sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.startTime}`);
      const dateTimeB = new Date(`${b.date}T${b.startTime}`);
      return dateTimeA.getTime() - dateTimeB.getTime();
    });
  };

  const sortPastAppointments = (apps: any[]) => {
    return [...apps].sort((a, b) => {
      const dateTimeA = new Date(`${a.date}T${a.startTime}`);
      const dateTimeB = new Date(`${b.date}T${b.startTime}`);
      return dateTimeB.getTime() - dateTimeA.getTime();
    });
  };

  // Login Form States
  const [isSignup, setIsSignup] = useState(false);
  const [signupName, setSignupName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [signupOtpSent, setSignupOtpSent] = useState(false);
  const [signupOtp, setSignupOtp] = useState('');
  const [isSendingSignupOtp, setIsSendingSignupOtp] = useState(false);

  // Geolocation Geocoder and OTP states
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [activeOtpApp, setActiveOtpApp] = useState<any | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState(false);

  // UX Enhancements: cancellation confirmation and toast notifications
  const [rescheduleApp, setRescheduleApp] = useState<any | null>(null);
  const isTimeSelectionDisabled = rescheduleApp ? (() => {
    const [y, m, d] = rescheduleApp.date.split('-').map(Number);
    const [hours, minutes] = rescheduleApp.startTime.split(':').map(Number);
    const scheduledTime = new Date(y, m - 1, d, hours, minutes, 0);
    const now = new Date();
    const timeDiffMinutes = (scheduledTime.getTime() - now.getTime()) / (60 * 1000);
    return timeDiffMinutes < 30;
  })() : false;
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (message: string) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMsg(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMsg(null);
    }, 4000);
  };

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Geolocation Radar Scanner States
  const [isLocationGranted, setIsLocationGranted] = useState(() => {
    return localStorage.getItem('barbo_location_granted') === 'true';
  });
  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanStatus, setScanStatus] = useState('');

  // Toggled appointments on Customer dashboard for showing the live map inline
  const [activeMapAppId, setActiveMapAppId] = useState<string | null>(null);

  // Sorting Barbers by proximity (ScissorsRock first, Nargis-2 second, LEGACY third)
  const sortedBarbers = [...barbers].sort((a, b) => a.distanceMeters - b.distanceMeters);

  // Selected barber in barber portal (resolved dynamically from authenticated user, fallback to b1)
  const activeBarberId = (currentUser && currentUser.role === 'barber' && currentUser.barberId) ? currentUser.barberId : 'b1';
  const activeBarber = barbers.find((b) => b.id === activeBarberId) || barbers[0];

  useEffect(() => {
    if (currentUser && currentUser.role === 'barber' && activeBarber) {
      setSettingsOpeningTime(activeBarber.openingTime || '09:00');
      setSettingsClosingTime(activeBarber.closingTime || '21:00');
      setSettingsWorkingDays(activeBarber.workingDays ? activeBarber.workingDays.split(',') : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      setSettingsMapsUrl(activeBarber.mapsUrl || '');
      setSettingsTagline(activeBarber.title || 'Premium Professional Grooming');
      setSettingsCapacity(activeBarber.chairsCount || 2);
      setProfileImageUrlInput(activeBarber.imageUrl || '');
      setLocationChangeReason('');
    }
  }, [activeBarberId, activeBarber, currentUser]);


  // Booking Modal States
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    return getLocalDateString();
  });
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Gender/Category Filter State for Landing page
  const [activeGenderFilter, setActiveGenderFilter] = useState<'all' | 'men' | 'women'>('all');
  const [selectedQuickLink, setSelectedQuickLink] = useState<string | null>(null);

  // Helper to filter barbers based on category and quick-link
  const isBarberMatchingGender = (barber: Barber, filter: 'all' | 'men' | 'women') => {
    if (filter === 'all') return true;
    if (filter === 'women') {
      const isUnisexName = /unisex|spa|family|women|lady|looks|mirrors/i.test(
        barber.name + ' ' + barber.specialty + ' ' + barber.title
      );
      const hasWomenService = services.some(s => s.barberId === barber.id && s.category === 'women');
      return isUnisexName || hasWomenService;
    }
    return true;
  };

  // Dynamic copies for rebranding
  const heroSubtitle = activeGenderFilter === 'men' 
    ? "Find Bhopal's premier grooming studios and unisex salons. Book precision fades, sharp beard trims, and classic hair styling instantly."
    : activeGenderFilter === 'women'
    ? "Discover premium styling lounges and unisex salons in Bhopal. Book professional hair styling, luxury hair spas, and rejuvenating skin care."
    : "Find the finest salons & styling studios in Bhopal, browse verified dynamic menus, and book your appointment in under 30 seconds.";

  const discoverSubtitle = activeGenderFilter === 'men'
    ? "Explore top-rated grooming spots and unisex salons in Bhopal specializing in classic fades, sharp styling, and relaxing treatments."
    : activeGenderFilter === 'women'
    ? "Discover premium unisex salons and styling lounges offering advanced hair spas, professional styling, and rejuvenating facials."
    : "Browse top-rated salons, check styling schedules, and book slots instantly with zero prepayment.";

  const quickLinksData = {
    all: ['Haircut', 'Beard Trim', 'Hair Spa', 'Blowout', 'Champi', 'Facial'],
    men: ['Haircut', 'Beard Trim', 'Champi', 'Detan'],
    women: ['Haircut', 'Hair Spa', 'Blowout', 'Facial']
  };
  const activeQuickLinks = quickLinksData[activeGenderFilter];

  const filteredBarbers = barbers.filter(barber => {
    if (!isBarberMatchingGender(barber, activeGenderFilter)) return false;
    if (selectedQuickLink) {
      const barberServices = services.filter(s => s.barberId === barber.id || !s.barberId);
      return barberServices.some(s => 
        s.name.toLowerCase().includes(selectedQuickLink.toLowerCase()) || 
        s.description.toLowerCase().includes(selectedQuickLink.toLowerCase())
      );
    }
    return true;
  });

  // Onboarding Modal States
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingTab, setOnboardingTab] = useState<'apply' | 'status'>('apply');
  const [onboardingEmailInput, setOnboardingEmailInput] = useState('');
  const [checkedApplication, setCheckedApplication] = useState<any | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  // Onboarding Form States
  const [onboardingShopName, setOnboardingShopName] = useState('');
  const [onboardingOwnerName, setOnboardingOwnerName] = useState('');
  const [onboardingEmail, setOnboardingEmail] = useState('');
  const [onboardingContactNumber, setOnboardingContactNumber] = useState('');
  const [onboardingLocation, setOnboardingLocation] = useState('');
  const [onboardingMapsUrl, setOnboardingMapsUrl] = useState('');
  const [onboardingChairsCount, setOnboardingChairsCount] = useState(2);
  const [onboardingOpeningTime, setOnboardingOpeningTime] = useState('09:00');
  const [onboardingClosingTime, setOnboardingClosingTime] = useState('21:00');
  const [onboardingWorkingDays, setOnboardingWorkingDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  const [onboardingServices, setOnboardingServices] = useState<{ name: string; price: number; durationMinutes: number; category?: 'men' | 'women' | 'unisex' }[]>([]);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('');
  const [newServiceDuration, setNewServiceDuration] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState<'men' | 'women' | 'unisex'>('unisex');
  const [submittingOnboarding, setSubmittingOnboarding] = useState(false);
  const [onboardingSuccess, setOnboardingSuccess] = useState(false);
  const [onboardingError, setOnboardingError] = useState('');

  // Onboarding OTP States
  const [onboardingOtp, setOnboardingOtp] = useState('');
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSentMessage, setOtpSentMessage] = useState('');
  const [otpVerifyMessage, setOtpVerifyMessage] = useState('');

  // Forgot Password / Reset Password States
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [isSendingForgotOtp, setIsSendingForgotOtp] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [forgotOtpSent, setForgotOtpSent] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  // Change Password States
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('');

  // Barber Portal Service Management & settings States
  const [portalNewServiceName, setPortalNewServiceName] = useState('');
  const [portalNewServicePrice, setPortalNewServicePrice] = useState('');
  const [portalNewServiceDuration, setPortalNewServiceDuration] = useState('');
  const [portalNewServiceCategory, setPortalNewServiceCategory] = useState<'men' | 'women' | 'unisex'>('unisex');
  const [settingsOpeningTime, setSettingsOpeningTime] = useState('');
  const [settingsClosingTime, setSettingsClosingTime] = useState('');
  const [settingsWorkingDays, setSettingsWorkingDays] = useState<string[]>([]);
  const [settingsMapsUrl, setSettingsMapsUrl] = useState('');
  const [settingsTagline, setSettingsTagline] = useState('');
  const [settingsCapacity, setSettingsCapacity] = useState(2);
  const [locationChangeReason, setLocationChangeReason] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [editServiceName, setEditServiceName] = useState('');
  const [editServicePrice, setEditServicePrice] = useState('');
  const [editServiceDuration, setEditServiceDuration] = useState('');
  const [editServiceCategory, setEditServiceCategory] = useState<'men' | 'women' | 'unisex'>('unisex');
  const [profileImageUrlInput, setProfileImageUrlInput] = useState('');
  const [isUploadingProfileImage, setIsUploadingProfileImage] = useState(false);
  const [isUploadingPortfolio, setIsUploadingPortfolio] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState<boolean>(false);

  // Upload and set profile image from a local file
  const handleProfileImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingProfileImage(true);
    const upload = await uploadImage(file);
    if (!upload.success || !upload.url) {
      showToast(upload.message || 'Failed to upload image.');
      setIsUploadingProfileImage(false);
      return;
    }
    setProfileImageUrlInput(upload.url);
    const res = await updateBarberProfileImage(activeBarber.id, upload.url);
    setIsUploadingProfileImage(false);
    showToast(res.message || (res.success ? 'Profile picture updated!' : 'Failed to update profile picture.'));
  };

  // Upload a portfolio image from a local file
  const handlePortfolioFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPortfolio(true);
    const upload = await uploadImage(file);
    if (!upload.success || !upload.url) {
      showToast(upload.message || 'Failed to upload image.');
      setIsUploadingPortfolio(false);
      return;
    }
    const res = await addBarberPortfolioImage(activeBarber.id, upload.url);
    setIsUploadingPortfolio(false);
    showToast(res.message || (res.success ? 'Image added to portfolio!' : 'Failed to add image.'));
    // Clear file input
    e.target.value = '';
  };

  const handleDeletePortfolioImage = async (url: string) => {
    const res = await deleteBarberPortfolioImage(activeBarber.id, url);
    if (res.success) {
      showToast(res.message || 'Image removed from portfolio!');
    } else {
      showToast(res.message || 'Failed to remove image.');
    }
  };

  const handleMovePortfolioImage = async (index: number, direction: 'left' | 'right') => {
    const images = [...(activeBarber.portfolioImages || [])];
    if (direction === 'left' && index > 0) {
      const temp = images[index];
      images[index] = images[index - 1];
      images[index - 1] = temp;
    } else if (direction === 'right' && index < images.length - 1) {
      const temp = images[index];
      images[index] = images[index + 1];
      images[index + 1] = temp;
    } else {
      return;
    }
    const res = await updateBarberPortfolioOrder(activeBarber.id, images);
    if (res.success) {
      showToast('Position updated successfully.');
    } else {
      showToast('Failed to update position.');
    }
  };

  // Add portfolio image from a preset URL
  const handleAddPortfolioPreset = async (presetUrl: string) => {
    if ((activeBarber.portfolioImages || []).includes(presetUrl)) {
      showToast('This image is already in your portfolio.');
      return;
    }
    const res = await addBarberPortfolioImage(activeBarber.id, presetUrl);
    showToast(res.message || (res.success ? 'Image added to portfolio!' : 'Failed to add image.'));
  };




  // Cancellation Modal States
  const [cancellingApp, setCancellingApp] = useState<any | null>(null);
  const [cancelReasonOption, setCancelReasonOption] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const cancelledAppIdsRef = useRef<Set<string>>(new Set());

  // Day & Night Theme State
  const [isLightMode, setIsLightMode] = useState(() => {
    return document.documentElement.getAttribute('data-theme') === 'light';
  });

  // GSAP Animation Refs
  const mainRef = useRef<HTMLDivElement>(null);

  // Browser GPS Geolocation Handler with reverse geocoding via Nominatim
  const handleShareLocation = () => {
    if (!navigator.geolocation) {
      setSearchError('Geolocation is not supported by your browser.');
      return;
    }
    
    setIsSearchingAddress(true);
    setSearchError('');
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        let lat = position.coords.latitude;
        let lon = position.coords.longitude;
        
        // Dynamic snaped threshold calculation:
        // Since Earth's circumference is 40,000km, any coordinate outside a 40km radius of Bhopal
        // is considered out-of-bounds for the testbed. We snap it to the Jahangirabad Jinsi center.
        const R = 6371e3; // Earth radius in meters
        const latRef = 23.2495;
        const lonRef = 77.4172;
        const φ1 = lat * Math.PI / 180;
        const φ2 = latRef * Math.PI / 180;
        const Δφ = (latRef - lat) * Math.PI / 180;
        const Δλ = (lonRef - lon) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distFromBhopal = R * c;

        let snapped = false;
        if (distFromBhopal > 40000) {
          lat = 23.2495;
          lon = 77.4172;
          snapped = true;
        }

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
          let displayName = snapped ? 'CL Colony Jinsi, Bhopal (GPS Snapped)' : `GPS Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
          if (!snapped && res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              displayName = data.display_name.split(',')[0] + ', Bhopal';
            }
          }
          setUserCoordinates({ lat, lng: lon });
          await fetchLocalBarbers(lat, lon, displayName);
          setSearchQuery('');
        } catch (err) {
          const rawName = snapped ? 'Jahangirabad, Bhopal (GPS Snapped)' : `GPS Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
          setUserCoordinates({ lat, lng: lon });
          await fetchLocalBarbers(lat, lon, rawName);
        } finally {
          setIsSearchingAddress(false);
        }
      },
      (_error) => {
        setIsSearchingAddress(false);
        setSearchError('Failed to retrieve location. Please check browser permissions.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  // Toggle Theme Function
  const handleToggleTheme = () => {
    const nextTheme = !isLightMode;
    setIsLightMode(nextTheme);
    if (nextTheme) {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  };
  
  // Real-time cancellation notification listener
  const prevAppointmentsRef = useRef<any[]>([]);
  useEffect(() => {
    if (prevAppointmentsRef.current.length > 0 && appointments.length > 0 && currentUser) {
      appointments.forEach((app) => {
        const prevApp = prevAppointmentsRef.current.find((a) => a.id === app.id);
        if (prevApp && prevApp.status !== 'cancelled' && app.status === 'cancelled') {
          const isCancelledLocally = cancelledAppIdsRef.current.has(app.id);
          if (!isCancelledLocally) {
            const reasonMatch = app.travelStatus && app.travelStatus.startsWith('Cancelled: ') 
              ? app.travelStatus.replace('Cancelled: ', '') 
              : 'No reason provided';
            
            if (currentUser.role === 'customer' && app.customerId === currentUser.id) {
              showToast(`Your appointment with ${app.barberName} on ${app.date} at ${app.startTime} was cancelled. Reason: ${reasonMatch}`);
            } else if (currentUser.role === 'barber' && app.barberId === activeBarberId) {
              showToast(`Appointment for ${app.customerName} on ${app.date} at ${app.startTime} was cancelled. Reason: ${reasonMatch}`);
            }
          }
        }
      });
    }
    prevAppointmentsRef.current = appointments;
  }, [appointments, currentUser, activeBarberId]);

  // Geolocation Radar scanning simulation timer hook
  useEffect(() => {
    let timer: any;
    if (isScanning) {
      setScanStep(0);
      setScanStatus('Booting concentric scanner networks...');
      
      const steps = [
        'Searching Bhopal network towers...',
        'Pinging Jahangirabad Jinsi coordinates...',
        'Detecting ScissorsRock, Nargis-2, and LEGACY nodes...',
        'Compiling optimal path metrics...',
        'Telemetry coordinates synchronized! Unlocking dashboard...'
      ];

      let currentStep = 0;
      timer = setInterval(() => {
        currentStep++;
        if (currentStep < steps.length) {
          setScanStep(currentStep);
          setScanStatus(steps[currentStep]);
        } else {
          clearInterval(timer);
          localStorage.setItem('barbo_location_granted', 'true');
          setIsLocationGranted(true);
          setIsScanning(false);
        }
      }, 700);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isScanning]);

  // GSAP animations on dashboard mount
  useEffect(() => {
    if (currentUser) {
      // Premium spring card load animations
      gsap.fromTo(".gsap-card", 
        { opacity: 0, y: 40, scale: 0.96 }, 
        { 
          opacity: 1, 
          y: 0, 
          scale: 1, 
          duration: 0.65, 
          ease: "back.out(1.2)", 
          stagger: 0.1,
          clearProps: "all"
        }
      );
      // Banner slide-down
      gsap.fromTo(".gsap-hero",
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }
      );
    } else {
      // Login screen bounce-in
      gsap.fromTo(".gsap-login-box",
        { opacity: 0, y: 50, scale: 0.94 },
        { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.5)" }
      );
    }
  }, [currentUser]);



  // Onboarding Status Checker
  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingEmailInput.trim()) {
      setStatusMessage('Please enter your email address.');
      return;
    }
    setCheckingStatus(true);
    setStatusMessage('');
    setCheckedApplication(null);

    const res = await checkApplicationStatus(onboardingEmailInput);
    setCheckingStatus(false);
    if (res.success && res.application) {
      setCheckedApplication(res.application);
    } else {
      setStatusMessage('No application found with this email.');
    }
  };

  // Onboarding OTP Event Handlers
  const handleSendOnboardingOtp = async () => {
    if (!onboardingEmail.trim()) {
      setOnboardingError('Please enter an email address first.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(onboardingEmail.trim())) {
      setOnboardingError('Please enter a valid email address.');
      return;
    }
    setIsSendingOtp(true);
    setOtpSentMessage('');
    setOnboardingError('');
    const res = await sendOnboardingOtp(onboardingEmail);
    setIsSendingOtp(false);
    if (res.success) {
      setShowOtpInput(true);
      setOtpSentMessage(res.message);
    } else {
      setOnboardingError(res.message);
    }
  };

  const handleVerifyOnboardingOtp = async () => {
    if (!onboardingOtp.trim()) {
      setOtpVerifyMessage('Please enter the OTP.');
      return;
    }
    setIsVerifyingOtp(true);
    setOtpVerifyMessage('');
    const res = await verifyOnboardingOtp(onboardingEmail, onboardingOtp);
    setIsVerifyingOtp(false);
    if (res.success) {
      setIsEmailVerified(true);
      setShowOtpInput(false);
      setOtpSentMessage('');
      showToast('Email verified successfully!');
    } else {
      setOtpVerifyMessage(res.message);
    }
  };

  // Forgot Password / Reset Password Handlers
  const handleSendForgotOtp = async () => {
    if (!forgotEmail.trim()) {
      setForgotError('Please enter your email address.');
      return;
    }
    setIsSendingForgotOtp(true);
    setForgotError('');
    setForgotSuccess('');
    const res = await sendResetPasswordOtp(forgotEmail);
    setIsSendingForgotOtp(false);
    if (res.success) {
      setForgotOtpSent(true);
      setForgotSuccess(res.message);
    } else {
      setForgotError(res.message);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim() || !forgotNewPassword.trim() || !forgotConfirmPassword.trim()) {
      setForgotError('All fields are required.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    if (forgotNewPassword.length < 6) {
      setForgotError('Password must be at least 6 characters long.');
      return;
    }
    setIsResettingPassword(true);
    setForgotError('');
    setForgotSuccess('');
    const res = await resetPasswordWithOtp(forgotEmail, forgotOtp, forgotNewPassword);
    setIsResettingPassword(false);
    if (res.success) {
      setForgotSuccess(res.message);
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotOtpSent(false);
        setForgotSuccess('');
      }, 2000);
    } else {
      setForgotError(res.message);
    }
  };

  // Change Password Handler
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword.trim() || !newPasswordVal.trim() || !confirmNewPassword.trim()) {
      setChangePasswordError('All fields are required.');
      return;
    }
    if (newPasswordVal !== confirmNewPassword) {
      setChangePasswordError('New passwords do not match.');
      return;
    }
    if (newPasswordVal.length < 6) {
      setChangePasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (!currentUser) {
      setChangePasswordError('You must be logged in to change password.');
      return;
    }
    setIsChangingPassword(true);
    setChangePasswordError('');
    setChangePasswordSuccess('');
    const res = await changePassword(currentUser.email, oldPassword, newPasswordVal);
    setIsChangingPassword(false);
    if (res.success) {
      setChangePasswordSuccess(res.message);
      setOldPassword('');
      setNewPasswordVal('');
      setConfirmNewPassword('');
      setTimeout(() => {
        setShowChangePasswordModal(false);
        setChangePasswordSuccess('');
      }, 2000);
    } else {
      setChangePasswordError(res.message);
    }
  };

  // Onboarding Form Submission
  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onboardingShopName.trim()) {
      setOnboardingError('Please enter your Shop / Salon Name.');
      showToast('⚠️ Shop Name is required.');
      return;
    }

    if (!onboardingOwnerName.trim()) {
      setOnboardingError('Please enter the Owner / Main Barber Name.');
      showToast('⚠️ Owner Name is required.');
      return;
    }

    if (!onboardingEmail.trim()) {
      setOnboardingError('Please enter your email address.');
      showToast('⚠️ Email is required.');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(onboardingEmail.trim())) {
      setOnboardingError('Please enter a valid email address.');
      showToast('⚠️ Invalid email address.');
      return;
    }

    if (!isEmailVerified) {
      setOnboardingError('Please verify your email address via OTP before submitting.');
      showToast('⚠️ Email verification required via OTP.');
      return;
    }

    if (!onboardingContactNumber.trim()) {
      setOnboardingError('Please enter your contact number.');
      showToast('⚠️ Contact number is required.');
      return;
    }

    // Validate contact number (exactly 10 digits after stripping non-numeric characters)
    const cleanedContact = onboardingContactNumber.trim().replace(/\D/g, '');
    if (cleanedContact.length !== 10) {
      setOnboardingError('Contact number must be exactly 10 digits (e.g. 9876543210).');
      showToast('⚠️ Contact number must be 10 digits.');
      return;
    }

    if (!onboardingLocation.trim()) {
      setOnboardingError('Please enter your shop location address.');
      showToast('⚠️ Shop location is required.');
      return;
    }

    if (!onboardingMapsUrl.trim()) {
      setOnboardingError('Please provide a Google Maps URL for your shop.');
      showToast('⚠️ Google Maps URL is required.');
      return;
    }

    // Validate Google Maps Link format
    const isGoogleMaps = (url: string) => {
      const trimmed = url.trim();
      if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        return false;
      }
      return /google\..*\/maps/i.test(trimmed) || 
             /maps\.app\.goo\.gl/i.test(trimmed) || 
             /goo\.gl\/maps/i.test(trimmed);
    };
    if (!isGoogleMaps(onboardingMapsUrl)) {
      setOnboardingError('Please enter a valid Google Maps link (e.g. https://maps.app.goo.gl/... or https://google.com/maps/...).');
      showToast('⚠️ Invalid Google Maps link.');
      return;
    }

    if (onboardingServices.length === 0) {
      setOnboardingError('Please add at least one service offered by your shop in the price menu below.');
      showToast('⚠️ Please add at least one service to your menu.');
      return;
    }

    setSubmittingOnboarding(true);
    setOnboardingError('');
    setOnboardingSuccess(false);

    // Parse coordinates from Maps URL
    let parsedLat = 23.2500;
    let parsedLon = 77.4100;
    const placeMatch = onboardingMapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (placeMatch) {
      parsedLat = parseFloat(placeMatch[1]);
      parsedLon = parseFloat(placeMatch[2]);
    } else {
      const coordMatch = onboardingMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                         onboardingMapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                         onboardingMapsUrl.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                         onboardingMapsUrl.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
      if (coordMatch) {
        parsedLat = parseFloat(coordMatch[1]);
        parsedLon = parseFloat(coordMatch[2]);
      }
    }

    const appData = {
      shopName: onboardingShopName,
      ownerName: onboardingOwnerName,
      email: onboardingEmail,
      contactNumber: onboardingContactNumber,
      location: onboardingLocation,
      mapsUrl: onboardingMapsUrl.trim(),
      lat: parsedLat,
      lon: parsedLon,
      chairsCount: onboardingChairsCount,
      openingTime: onboardingOpeningTime,
      closingTime: onboardingClosingTime,
      workingDays: onboardingWorkingDays.join(',')
    };

    const res = await submitApplication(appData, onboardingServices);
    setSubmittingOnboarding(false);
    if (res.success) {
      setOnboardingSuccess(true);
      showToast('Onboarding application submitted successfully!');
      // Clear form
      setOnboardingShopName('');
      setOnboardingOwnerName('');
      setOnboardingEmail('');
      setOnboardingContactNumber('');
      setOnboardingLocation('');
      setOnboardingMapsUrl('');
      setOnboardingWorkingDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      setOnboardingServices([]);
      setOnboardingOtp('');
      setIsEmailVerified(false);
      setShowOtpInput(false);
    } else {
      setOnboardingError(res.message);
    }
  };

  // Onboarding Services List Management
  const handleAddOnboardingService = () => {
    if (!newServiceName.trim()) return;
    const price = Number(newServicePrice) || 100;
    const duration = Number(newServiceDuration) || 20;
    setOnboardingServices(prev => [...prev, { 
      name: newServiceName.trim(), 
      price, 
      durationMinutes: duration, 
      category: newServiceCategory 
    }]);
    setNewServiceName('');
    setNewServicePrice('');
    setNewServiceDuration('');
    setNewServiceCategory('unisex');
  };

  const handleRemoveOnboardingService = (index: number) => {
    setOnboardingServices(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleEditAndResubmit = (app: any) => {
    setOnboardingShopName(app.shopName);
    setOnboardingOwnerName(app.ownerName);
    setOnboardingEmail(app.email);
    setOnboardingContactNumber(app.contactNumber);
    setOnboardingLocation(app.location);
    setOnboardingMapsUrl(app.mapsUrl || '');
    setOnboardingChairsCount(app.chairsCount);
    setOnboardingOpeningTime(app.openingTime);
    setOnboardingClosingTime(app.closingTime);
    setOnboardingWorkingDays(app.workingDays ? app.workingDays.split(',') : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    setOnboardingServices(app.services || []);
    setOnboardingTab('apply');
    setCheckedApplication(null);
    setOnboardingSuccess(false);
    setOnboardingError('');
  };

  // Admin Portal Actions - Managed in AdminConsole component

  // Quick Autocomplete Helper for Grading
  const handleQuickLogin = (roleMail: string) => {
    setEmail(roleMail);
    setPassword('123456');
    setLoginError('');
  };

  // Handle Login/Signup Submission
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignup && !signupName.trim()) {
      setLoginError('Please enter your name.');
      return;
    }
    if (!email || !password) {
      setLoginError('Please enter both email and password.');
      return;
    }

    if (isSignup && !signupOtpSent) {
      setIsSendingSignupOtp(true);
      setLoginError('');
      const res = await sendSignupOtp(email);
      setIsSendingSignupOtp(false);
      if (res.success) {
        setSignupOtpSent(true);
        showToast(res.message);
      } else {
        setLoginError(res.message);
      }
      return;
    }

    const res = isSignup 
      ? await signup(signupName, email, password, signupOtp)
      : await login(email, password);

    if (res.success) {
      setLoginError('');
      // Wipe login/signup inputs
      setEmail('');
      setSignupName('');
      setPassword('');
      setSignupOtp('');
      setSignupOtpSent(false);
      setIsSignup(false);
      if (isSignup) {
        showToast('Account successfully created! Welcome to Barbo.');
      }
    } else {
      setLoginError(res.message);
    }
  };

  // Auto-calculated fields for booking
  const totalDuration = services
    .filter((s) => selectedServiceIds.includes(s.id))
    .reduce((sum, s) => sum + s.durationMinutes, 0);

  const totalPrice = services
    .filter((s) => selectedServiceIds.includes(s.id))
    .reduce((sum, s) => sum + s.price, 0);

  // Default Time Slots fallback
  const getDayOfWeekAbbreviation = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dateObj.getDay()];
  };

  const isAppointmentExpired = (app: any) => {
    if (!app.date || !app.endTime) return false;
    const [y, m, d] = app.date.split('-').map(Number);
    const [endH, endM] = app.endTime.split(':').map(Number);
    const slotEndTime = new Date(y, m - 1, d, endH, endM, 0);
    return new Date().getTime() > slotEndTime.getTime();
  };

  const getDynamicTimeSlots = (barber: Barber | null) => {
    const opening = barber?.openingTime || '09:00';
    const closing = barber?.closingTime || '21:00';
    
    const [opH, opM] = opening.split(':').map(Number);
    const [clH, clM] = closing.split(':').map(Number);
    
    const slots: string[] = [];
    let currentMin = opH * 60 + (opM || 0);
    const endMin = clH * 60 + (clM || 0);
    
    // Safety check in case values are malformed
    if (isNaN(currentMin) || isNaN(endMin) || currentMin >= endMin) {
      return [
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
        '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
        '17:00', '17:30'
      ];
    }
    
    const maxStartMin = endMin - totalDuration;
    
    while (currentMin <= maxStartMin) {
      const h = Math.floor(currentMin / 60);
      const m = currentMin % 60;
      const hStr = String(h).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      slots.push(`${hStr}:${mStr}`);
      currentMin += 30;
    }
    return slots;
  };

  const handleOpenBooking = (barber: Barber) => {
    setSelectedBarber(barber);
    setRescheduleApp(null);
    setSelectedServiceIds([]);
    setSelectedTimeSlot('');
    setBookingSuccess(false);
    setBookingError('');
    setIsBookingOpen(true);

    // Modal Spring Animate
    setTimeout(() => {
      gsap.fromTo(".gsap-modal",
        { scale: 0.9, y: 30, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.5)" }
      );
    }, 50);
  };

  const handleOpenReschedule = (app: any) => {
    const barber = barbers.find((b) => b.id === app.barberId);
    if (!barber) return;
    
    setSelectedBarber(barber);
    setRescheduleApp(app);
    
    setSelectedDate(app.date);
    setSelectedTimeSlot(app.startTime);
    setSelectedServiceIds(app.services.map((s: any) => s.id));
    
    setBookingSuccess(false);
    setBookingError('');
    setIsBookingOpen(true);

    setTimeout(() => {
      gsap.fromTo(".gsap-modal",
        { scale: 0.9, y: 30, opacity: 0 },
        { scale: 1, y: 0, opacity: 1, duration: 0.4, ease: "back.out(1.5)" }
      );
    }, 50);
  };

  const handleToggleService = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId)
        ? prev.filter((id) => id !== serviceId)
        : [...prev, serviceId]
    );
    setSelectedTimeSlot('');
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rescheduleApp) {
      if (!selectedDate || !selectedTimeSlot) {
        setBookingError('Please select date and time slot.');
        return;
      }
      const res = await rescheduleAppointment(
        rescheduleApp.id,
        selectedDate,
        selectedTimeSlot,
        selectedServiceIds
      );
      if (res.success) {
        setBookingSuccess(true);
        setBookingError('');
        // Success spring effect
        gsap.to(".gsap-modal", { scale: 0.97, duration: 0.2, yoyo: true, repeat: 1 });
        setTimeout(() => {
          setIsBookingOpen(false);
          setRescheduleApp(null);
          setBookingSuccess(false);
          showToast('Appointment rescheduled successfully!');
        }, 1600);
      } else {
        setBookingError(res.message);
      }
      return;
    }

    if (!selectedBarber || !selectedDate || !selectedTimeSlot || selectedServiceIds.length === 0) {
      setBookingError('Please fill out all booking selections.');
      return;
    }

    const success = await bookAppointment(
      selectedBarber.id,
      selectedDate,
      selectedTimeSlot,
      selectedServiceIds,
      'Pay At Shop',
      'unpaid'
    );

    if (success) {
      setBookingSuccess(true);
      setBookingError('');
      // Success spring effect
      gsap.to(".gsap-modal", { scale: 0.97, duration: 0.2, yoyo: true, repeat: 1 });
      setTimeout(() => {
        setIsBookingOpen(false);
        setBookingSuccess(false);
        showToast('Appointment booked successfully!');
      }, 1600);
    } else {
      setBookingError('Double booking detected! Time slot overlaps with an existing appointment.');
    }
  };

  const activeBarberBookings = appointments.filter((app) => app.barberId === activeBarber.id);
  const sortedBarberBookings = [...activeBarberBookings].sort((a, b) => {
    const isFinishedA = a.status === 'completed' || a.status === 'cancelled' || isAppointmentExpired(a);
    const isFinishedB = b.status === 'completed' || b.status === 'cancelled' || isAppointmentExpired(b);
    if (isFinishedA && !isFinishedB) return 1;
    if (!isFinishedA && isFinishedB) return -1;

    const dateTimeA = new Date(`${a.date}T${a.startTime}`);
    const dateTimeB = new Date(`${b.date}T${b.startTime}`);
    
    if (isFinishedA && isFinishedB) {
      return dateTimeB.getTime() - dateTimeA.getTime();
    }
    return dateTimeA.getTime() - dateTimeB.getTime();
  });
  const completedBookings = activeBarberBookings.filter((app) => app.status === 'completed');
  const dailyEarnings = completedBookings.reduce((sum, app) => sum + app.totalPrice, 0);

  // ==========================================
  // UNCONNECTED/LOGIN VIEW
  // ==========================================
  if (!currentUser) {
    return (
      <div className="landing-container animate-fade-in">
        {/*      <div className="landing-container animate-fade-in">
        {/* Navigation Bar */}
        <header className="landing-nav">
          <div className="landing-nav-logo">
            <Scissors size={20} />
            BAR<span>BO</span>
          </div>
          <nav className="landing-nav-links">
            <a href="#discover" className="landing-nav-link">Discover Salons</a>
            <a href="#why-choose-us" className="landing-nav-link">Why Choose Us?</a>
            <a href="#how-it-works" className="landing-nav-link">How It Works</a>
          </nav>
          <div className="landing-nav-actions">
            <button 
              className="btn-secondary" 
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => {
                setLoginError('');
                setShowLoginModal(true);
              }}
            >
              Sign In
            </button>
            <button 
              className="gold-glow-btn"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => {
                setOnboardingTab('apply');
                setOnboardingError('');
                setOnboardingSuccess(false);
                setShowOnboardingModal(true);
              }}
            >
              Partner with Us
            </button>
          </div>
        </header>

        {/* Hero Section */}
        <section className="landing-hero" style={{ minHeight: '80vh', display: 'flex', justifyContent: 'center' }}>
          <div className="landing-badge">
            <Sparkles size={14} /> Bhopal's Premier Grooming Network
          </div>
          <h1 className="landing-title">
            Styling, <span>Simplified</span>.<br />Booking, <span>Elevated</span>.
          </h1>
          <p className="landing-subtitle">
            {heroSubtitle}
          </p>
          <div className="landing-hero-actions">
            <a 
              href="#discover" 
              className="gold-glow-btn"
              style={{ padding: '16px 32px', fontSize: '1.05rem', textDecoration: 'none' }}
            >
              Book a Salon <ChevronRight size={18} />
            </a>
            <button 
              className="btn-secondary"
              style={{ padding: '16px 32px', fontSize: '1.05rem' }}
              onClick={() => {
                setOnboardingTab('apply');
                setOnboardingError('');
                setOnboardingSuccess(false);
                setShowOnboardingModal(true);
              }}
            >
              List Your Shop
            </button>
          </div>
        </section>

        {/* Featured Salons Section */}
        <section className="landing-section" id="discover" style={{ borderTop: '1px solid var(--border-light)' }}>
          <div className="landing-section-header">
            <div className="landing-badge" style={{ marginBottom: '8px' }}>
              <Building size={12} /> Elite Partners
            </div>
            <h2 className="landing-section-title">Discover Premium Salons</h2>
            <p className="landing-section-subtitle">
              {discoverSubtitle}
            </p>
          </div>

          {/* Segmented Category Filter Tabs */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
            <div style={{ 
              display: 'inline-flex', 
              background: 'var(--bg-secondary)', 
              padding: '6px', 
              borderRadius: '30px', 
              border: '1px solid var(--border-light)',
              boxShadow: 'var(--shadow-premium)'
            }}>
              {[
                { id: 'all', label: '✨ All Services' },
                { id: 'men', label: '🧔 Men\'s Grooming' },
                { id: 'women', label: '👩 Women\'s Styling' }
              ].map((tab) => {
                const isActive = activeGenderFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveGenderFilter(tab.id as any);
                      setSelectedQuickLink(null);
                    }}
                    style={{
                      padding: '10px 24px',
                      borderRadius: '24px',
                      border: 'none',
                      background: isActive ? 'var(--accent-gold)' : 'transparent',
                      color: isActive ? '#000000' : 'var(--text-secondary)',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: isActive ? '0 4px 12px rgba(197, 168, 128, 0.3)' : 'none'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Filter Links */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '40px' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', alignSelf: 'center', marginRight: '6px' }}>Quick Filter:</span>
            {activeQuickLinks.map((link) => {
              const isSelected = selectedQuickLink === link;
              return (
                <button
                  key={link}
                  type="button"
                  onClick={() => setSelectedQuickLink(isSelected ? null : link)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid ' + (isSelected ? 'var(--accent-gold)' : 'var(--border-light)'),
                    background: isSelected ? 'rgba(197, 168, 128, 0.15)' : 'var(--bg-tertiary)',
                    color: isSelected ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    outline: 'none'
                  }}
                >
                  {link}
                </button>
              );
            })}
          </div>

          <div className="salons-grid">
            {filteredBarbers.length === 0 ? (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                No salons found matching the active filters.
              </div>
            ) : (
              filteredBarbers.map((barber) => {
                const barberServices = services.filter(s => s.barberId === barber.id || !s.barberId);
                const minPrice = barberServices.length > 0 ? Math.min(...barberServices.map(s => s.price)) : 100;
                
                return (
                  <div key={barber.id} className="salon-card">
                    <div 
                      className="salon-card-image" 
                      style={{ 
                        backgroundImage: `linear-gradient(to bottom, transparent, rgba(10,11,14,0.9)), url('${barber.imageUrl}')` 
                      }}
                    >
                      <div className="salon-card-badge">
                        <Star size={14} fill="var(--accent-gold)" /> {barber.rating}
                      </div>
                    </div>
                    <div className="salon-card-content">
                      <h3 className="salon-card-title">{barber.name}</h3>
                       <div className="salon-card-meta">
                        <div className="salon-card-meta-item">
                          <MapPin size={14} />
                          {barber.mapsUrl ? (
                            <a 
                              href={barber.mapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ 
                                color: 'inherit', 
                                textDecoration: 'none',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {barber.location}
                            </a>
                          ) : (
                            <span>{barber.location}</span>
                          )}
                        </div>
                        <div className="salon-card-meta-item">
                          <Clock size={14} />
                          <span>
                            {barber.openingTime && barber.closingTime 
                              ? `${formatTime(barber.openingTime)} - ${formatTime(barber.closingTime)}` 
                              : '09:00 AM - 09:00 PM'}
                          </span>
                        </div>
                      </div>
                      <div className="salon-card-footer">
                        <div className="salon-card-price">
                          Haircut Starts At
                          <span>₹{minPrice}</span>
                        </div>
                        <button 
                          className="gold-glow-btn salon-card-btn"
                          onClick={() => {
                            setLoginError('');
                            setShowLoginModal(true);
                          }}
                        >
                          Book Now
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section className="landing-section" id="why-choose-us" style={{ borderTop: '1px solid var(--border-light)' }}>
          <div className="landing-section-header">
            <h2 className="landing-section-title">Why Choose Barbo?</h2>
            <p className="landing-section-subtitle">
              We connect style-conscious clients with verified grooming professionals under a unified, premium network.
            </p>
          </div>

          <div className="landing-features-grid">
            {/* For Customers */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Scissors size={22} />
              </div>
              <h3 className="landing-feature-title">For Customers</h3>
              <div className="landing-feature-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px' }} />
                  <span><strong>Instant Slot Booking:</strong> Pick your service, choose an available time slot, and get instant confirmation.</span>
                </div>
                <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px' }} />
                  <span><strong>Zero Upfront Payments:</strong> Book online entirely free, and pay directly at the shop after your haircut.</span>
                </div>
                <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px' }} />
                  <span><strong>Transparent Pricing:</strong> Review catalog service prices, descriptions, and duration limits beforehand.</span>
                </div>
              </div>
            </div>

            {/* For Salons */}
            <div className="landing-feature-card">
              <div className="landing-feature-icon">
                <Building size={22} />
              </div>
              <h3 className="landing-feature-title">For Salons (Partners)</h3>
              <div className="landing-feature-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px' }} />
                  <span><strong>0% Platform Commission:</strong> Keep 100% of your earnings. No listing commission fees.</span>
                </div>
                <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px' }} />
                  <span><strong>Custom Partner Console:</strong> Update timing, seats capacity, and service pricings in real-time.</span>
                </div>
                <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--accent-gold)', marginTop: '2px' }} />
                  <span><strong>Attract More Customers:</strong> Gain organic visibility among style-seekers in your local Bhopal area.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="landing-section" id="how-it-works" style={{ borderTop: '1px solid var(--border-light)', paddingBottom: '40px' }}>
          <div className="landing-section-header">
            <h2 className="landing-section-title">How It Works</h2>
            <p className="landing-section-subtitle">
              Unified scheduling flows designed for maximum speed and absolute convenience.
            </p>
          </div>

          <div className="landing-how-works">
            <div className="landing-step-card">
              <span className="landing-step-number">01</span>
              <h4 className="landing-step-title">Discover</h4>
              <p className="landing-step-desc">
                Browse premium salons in Bhopal or search for your favorite stylist's availability.
              </p>
            </div>
            <div className="landing-step-card">
              <span className="landing-step-number">02</span>
              <h4 className="landing-step-title">Reserve Slot</h4>
              <p className="landing-step-desc">
                Choose your haircut services, pick your styling date/time slot, and confirm instantly.
              </p>
            </div>
            <div className="landing-step-card">
              <span className="landing-step-number">03</span>
              <h4 className="landing-step-title">Pay at Shop</h4>
              <p className="landing-step-desc">
                Visit the salon at your scheduled time, enjoy premium grooming, and pay at the shop!
              </p>
            </div>
          </div>
        </section>

        {/* Partner Onboarding CTA */}
        <section className="landing-cta-section" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
          <div className="landing-badge">
            <Building size={14} style={{ marginRight: '6px' }} /> Partner Portal
          </div>
          <h2 style={{ fontSize: '2rem', fontWeight: 800 }}>Grow Your Salon Business</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', fontSize: '0.95rem', margin: '0 auto' }}>
            List your shop, manage appointments digitally, and connect directly with local Bhopal customers. 100% Commission Free.
          </p>
          <button 
            className="gold-glow-btn"
            style={{ padding: '14px 28px', marginTop: '10px' }}
            onClick={() => {
              setOnboardingTab('apply');
              setOnboardingError('');
              setOnboardingSuccess(false);
              setShowOnboardingModal(true);
            }}
          >
            Partner with Us / List Your Shop
          </button>
        </section>

        {/* Footer */}
        <footer className="landing-footer">
          <p>© 2026 Barbo Bhopal. Premium Salon Discovery, Booking & Onboarding Platform.</p>
        </footer>

        {/* Login Modal Overlay */}
        {showLoginModal && (
          <div className="modal-overlay-backdrop animate-fade-in" onClick={() => {
            setShowLoginModal(false);
            setSignupOtpSent(false);
            setSignupOtp('');
          }}>
            <div 
              className="glass-card gsap-login-box" 
              style={{ width: '100%', maxWidth: '440px', padding: '40px 32px', position: 'relative' }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button 
                onClick={() => {
                  setShowLoginModal(false);
                  setShowForgotPassword(false);
                  setForgotOtpSent(false);
                  setForgotError('');
                  setForgotSuccess('');
                  setSignupOtpSent(false);
                  setSignupOtp('');
                }}
                style={{ 
                  position: 'absolute', 
                  top: '20px', 
                  right: '20px', 
                  background: 'transparent', 
                  border: 'none', 
                  color: 'var(--text-secondary)', 
                  cursor: 'pointer' 
                }}
              >
                <X size={20} />
              </button>

              {showForgotPassword ? (
                <>
                  {/* Forgot Password Screen */}
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-gold-glow)', borderRadius: '50%', color: 'var(--accent-gold)', marginBottom: '12px' }}>
                      <Lock size={24} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '-0.02em', fontWeight: 800 }}>
                      Reset <span>Password</span>
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Recover your account password</p>
                  </div>

                  {forgotError && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{forgotError}</span>
                    </div>
                  )}

                  {forgotSuccess && (
                    <div style={{ background: 'rgba(34, 197, 94, 0.08)', color: 'var(--status-green)', border: '1px solid rgba(34, 197, 94, 0.15)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>✓ {forgotSuccess}</span>
                    </div>
                  )}

                  {!forgotOtpSent ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Email Address
                        </label>
                        <div style={{ position: 'relative' }}>
                          <Mail size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                          <input 
                            type="email"
                            placeholder="name@domain.com"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            style={{ width: '100%', padding: '12px 16px 12px 42px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                          />
                        </div>
                      </div>
                      <button 
                        onClick={handleSendForgotOtp}
                        disabled={isSendingForgotOtp}
                        className="gold-glow-btn"
                        style={{ justifyContent: 'center', marginTop: '10px', padding: '12px' }}
                      >
                        {isSendingForgotOtp ? 'Sending OTP...' : 'Send Reset OTP'}
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Verification OTP
                        </label>
                        <input 
                          type="text"
                          placeholder="Enter 6-digit OTP"
                          value={forgotOtp}
                          onChange={(e) => setForgotOtp(e.target.value)}
                          style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          New Password
                        </label>
                        <input 
                          type="password"
                          placeholder="At least 6 characters"
                          value={forgotNewPassword}
                          onChange={(e) => setForgotNewPassword(e.target.value)}
                          style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Confirm New Password
                        </label>
                        <input 
                          type="password"
                          placeholder="Confirm new password"
                          value={forgotConfirmPassword}
                          onChange={(e) => setForgotConfirmPassword(e.target.value)}
                          style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isResettingPassword}
                        className="gold-glow-btn"
                        style={{ justifyContent: 'center', marginTop: '10px', padding: '12px' }}
                      >
                        {isResettingPassword ? 'Resetting...' : 'Update Password'}
                      </button>
                    </form>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem' }}>
                    <span 
                      onClick={() => {
                        setShowForgotPassword(false);
                        setForgotOtpSent(false);
                        setForgotError('');
                        setForgotSuccess('');
                      }} 
                      style={{ color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      Back to Sign In
                    </span>
                  </div>
                </>
              ) : (
                <>
                  {/* Logo Branding */}
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-gold-glow)', borderRadius: '50%', color: 'var(--accent-gold)', marginBottom: '12px' }}>
                      <Scissors size={24} />
                    </div>
                    <h2 style={{ fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '-0.02em', fontWeight: 800 }}>
                      BAR<span>BO</span>
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Access your custom portal</p>
                  </div>

                  {loginError && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={16} style={{ flexShrink: 0 }} />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Form */}
                  <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {isSignup && signupOtpSent ? (
                      <>
                        <div style={{ textAlign: 'center', margin: '4px 0' }}>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            We've sent a 6-digit verification code to <strong style={{ color: 'var(--accent-gold)' }}>{email}</strong>.
                          </p>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Verification OTP
                          </label>
                          <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                            <input 
                              type="text"
                              placeholder="6-digit OTP code"
                              value={signupOtp}
                              onChange={(e) => setSignupOtp(e.target.value)}
                              style={{ width: '100%', padding: '12px 16px 12px 42px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                              required
                            />
                          </div>
                        </div>
                        <button 
                          type="submit" 
                          className="gold-glow-btn"
                          style={{ justifyContent: 'center', marginTop: '10px', padding: '12px' }}
                        >
                          Verify & Register
                        </button>
                        <div style={{ textAlign: 'center', marginTop: '12px' }}>
                          <span 
                            onClick={() => {
                              setSignupOtpSent(false);
                              setSignupOtp('');
                            }}
                            style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                          >
                            Change Email / Go Back
                          </span>
                        </div>
                      </>
                    ) : (
                      <>
                        {isSignup && (
                          <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                              Full Name
                            </label>
                            <div style={{ position: 'relative' }}>
                              <User size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                              <input 
                                type="text"
                                placeholder="John Doe"
                                value={signupName}
                                onChange={(e) => setSignupName(e.target.value)}
                                style={{ width: '100%', padding: '12px 16px 12px 42px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                              />
                            </div>
                          </div>
                        )}

                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Email Address
                          </label>
                          <div style={{ position: 'relative' }}>
                            <Mail size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                            <input 
                              type="email"
                              placeholder="name@domain.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              style={{ width: '100%', padding: '12px 16px 12px 42px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                            />
                          </div>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              Password
                            </label>
                            {!isSignup && (
                              <span 
                                onClick={() => {
                                  setShowForgotPassword(true);
                                  setForgotError('');
                                  setForgotSuccess('');
                                }}
                                style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 500 }}
                              >
                                Forgot Password?
                              </span>
                            )}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <Lock size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                            <input 
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              style={{ width: '100%', padding: '12px 16px 12px 42px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                            />
                          </div>
                        </div>

                        <button 
                          type="submit" 
                          disabled={isSendingSignupOtp}
                          className="gold-glow-btn"
                          style={{ justifyContent: 'center', marginTop: '10px', padding: '12px' }}
                        >
                          {isSignup 
                            ? (isSendingSignupOtp ? 'Sending OTP...' : 'Send Verification OTP') 
                            : 'Sign In'}
                        </button>
                      </>
                    )}
                  </form>

                  <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {isSignup ? 'Already have an account? ' : "Don't have an account? "}
                    </span>
                    <span 
                      onClick={() => {
                        setIsSignup(!isSignup);
                        setLoginError('');
                        setSignupOtpSent(false);
                        setSignupOtp('');
                      }} 
                      style={{ color: 'var(--accent-gold)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                    >
                      {isSignup ? 'Sign In' : 'Sign Up'}
                    </span>
                  </div>
                </>
              )}

              {/* Quick Credentials Autofill */}
              <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', textAlign: 'center' }}>
                  Quick Credentials Autofill
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}
                    onClick={() => {
                      handleQuickLogin('aayu@barbo.in');
                      setShowLoginModal(false);
                    }}
                  >
                    <span>Aayu</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>(Customer)</span>
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}
                    onClick={() => {
                      handleQuickLogin('rajesh@barbo.in');
                      setShowLoginModal(false);
                    }}
                  >
                    <span>Rajesh Sen</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>(Barber)</span>
                  </button>
                  <button 
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '6px', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}
                    onClick={() => {
                      handleQuickLogin('admin@barbo.in');
                      setShowLoginModal(false);
                    }}
                  >
                    <span>Admin</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>(Admin)</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Onboarding Form Modal (Added here to work when currentUser is null!) */}
        {showOnboardingModal && (
          <div className="modal-backdrop animate-fade-in" onClick={() => setShowOnboardingModal(false)}>
            <div 
              className="glass-card animate-scale-in" 
              style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', zIndex: 1100 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Building size={22} style={{ color: 'var(--accent-gold)' }} />
                    Partner with Barbo
                  </h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Get your salon listed on Bhopal's premium grooming network
                  </p>
                </div>
                <button 
                  onClick={() => setShowOnboardingModal(false)} 
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '24px' }}>
                <button 
                  onClick={() => setOnboardingTab('apply')}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    background: 'transparent', 
                    border: 'none', 
                    borderBottom: onboardingTab === 'apply' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                    color: onboardingTab === 'apply' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Apply for Listing
                </button>
                <button 
                  onClick={() => setOnboardingTab('status')}
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    background: 'transparent', 
                    border: 'none', 
                    borderBottom: onboardingTab === 'status' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                    color: onboardingTab === 'status' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Check Application Status
                </button>
              </div>

              {/* Apply Tab */}
              {onboardingTab === 'apply' && (
                <div>
                  {onboardingSuccess ? (
                    <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                      <CheckCircle size={48} style={{ color: 'var(--accent-gold)', marginBottom: '16px', marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                      <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Application Submitted!</h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                        Thank you for applying. Our admin team will review your application within 24 hours. You can check the status anytime using your email: <strong>{onboardingEmailInput || onboardingEmail}</strong>
                      </p>
                      <button className="gold-glow-btn" onClick={() => setShowOnboardingModal(false)}>
                        Close Portal
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      {/* Step Info Box */}
                      <div style={{ background: 'var(--accent-gold-glow)', border: '1px solid var(--border-subtle)', borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                        <h4 style={{ color: 'var(--accent-gold)', fontSize: '0.95rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles size={16} /> How to list your shop in 3 steps:
                        </h4>
                        <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <li><strong>Submit Form:</strong> Enter your basic shop info, seats, opening/closing hours, and services below.</li>
                          <li><strong>Admin Review:</strong> Our team verifies details (coordinates, price lists) to activate your shop profile.</li>
                          <li><strong>Go Live:</strong> Get approved, log in with your email, and start receiving live bookings commission-free!</li>
                        </ol>
                      </div>

                      {onboardingError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <AlertCircle size={16} />
                          <span>{onboardingError}</span>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Shop/Salon Name <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. Royal Barber Shop"
                            value={onboardingShopName}
                            onChange={(e) => setOnboardingShopName(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                            required
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Owner / Main Barber Name <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <input 
                            type="text" 
                            placeholder="e.g. Rajesh Kumar"
                            value={onboardingOwnerName}
                            onChange={(e) => setOnboardingOwnerName(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Contact Email (For logins) <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input 
                              type="email" 
                              placeholder="e.g. owner@shop.com"
                              value={onboardingEmail}
                              onChange={(e) => {
                                setOnboardingEmail(e.target.value);
                                setIsEmailVerified(false);
                                setShowOtpInput(false);
                              }}
                              disabled={isEmailVerified}
                              style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                              required
                            />
                            {!isEmailVerified && (
                              <button
                                type="button"
                                onClick={handleSendOnboardingOtp}
                                disabled={isSendingOtp || !onboardingEmail.trim()}
                                className="gold-glow-btn"
                                style={{ padding: '0 16px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                              >
                                {isSendingOtp ? 'Sending...' : 'Send OTP'}
                              </button>
                            )}
                          </div>
                          {isEmailVerified && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--status-green)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                              ✓ Email Verified
                            </span>
                          )}
                          {otpSentMessage && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: '4px', display: 'block' }}>
                              {otpSentMessage}
                            </span>
                          )}
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Contact Number <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <input 
                            type="tel" 
                            placeholder="e.g. 9876543210"
                            value={onboardingContactNumber}
                            onChange={(e) => setOnboardingContactNumber(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                            required
                          />
                        </div>
                      </div>

                      {showOtpInput && (
                        <div style={{ background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            Enter Email Verification OTP <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="text"
                              placeholder="6-digit OTP code"
                              value={onboardingOtp}
                              onChange={(e) => setOnboardingOtp(e.target.value)}
                              style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                            />
                            <button
                              type="button"
                              onClick={handleVerifyOnboardingOtp}
                              disabled={isVerifyingOtp}
                              className="gold-glow-btn"
                              style={{ padding: '0 20px', fontSize: '0.8rem' }}
                            >
                              {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                            </button>
                          </div>
                          {otpVerifyMessage && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--status-red)' }}>
                              {otpVerifyMessage}
                            </span>
                          )}
                        </div>
                      )}

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Shop Location Address <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. Plot 42, MP Nagar Zone 2, Bhopal"
                          value={onboardingLocation}
                          onChange={(e) => setOnboardingLocation(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          required
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Google Maps URL <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="url" 
                          placeholder="e.g. https://maps.google.com/?q=your+shop+location"
                          value={onboardingMapsUrl}
                          onChange={(e) => setOnboardingMapsUrl(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          required
                        />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                          Open Google Maps → Search your shop → Copy the URL from your browser
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Stylist Chairs Count <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <input 
                            type="number" 
                            min={1} 
                            max={15}
                            value={onboardingChairsCount}
                            onChange={(e) => setOnboardingChairsCount(Number(e.target.value) || 2)}
                            style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Opening Hours <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <input 
                            type="time" 
                            value={onboardingOpeningTime}
                            onChange={(e) => setOnboardingOpeningTime(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                            Closing Hours <span style={{ color: 'var(--status-red)' }}>*</span>
                          </label>
                          <input 
                            type="time" 
                            value={onboardingClosingTime}
                            onChange={(e) => setOnboardingClosingTime(e.target.value)}
                            style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          />
                        </div>
                      </div>

                      {/* Weekly Operating Days Selection */}
                      <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Weekly Operating Days <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                          {[
                            { day: 'Mon', label: 'Monday' },
                            { day: 'Tue', label: 'Tuesday' },
                            { day: 'Wed', label: 'Wednesday' },
                            { day: 'Thu', label: 'Thursday' },
                            { day: 'Fri', label: 'Friday' },
                            { day: 'Sat', label: 'Saturday' },
                            { day: 'Sun', label: 'Sunday' },
                          ].map((d) => {
                            const isChecked = onboardingWorkingDays.includes(d.day);
                            return (
                              <label 
                                key={d.day} 
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '6px', 
                                  padding: '8px 12px', 
                                  background: isChecked ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg-tertiary)', 
                                  border: isChecked ? '1px solid var(--accent-gold)' : '1px solid var(--border-light)', 
                                  borderRadius: '8px', 
                                  cursor: 'pointer',
                                  fontSize: '0.85rem',
                                  color: isChecked ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                  userSelect: 'none',
                                  transition: 'all 0.2s ease'
                                }}
                              >
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      if (onboardingWorkingDays.length > 1) {
                                        setOnboardingWorkingDays(onboardingWorkingDays.filter(day => day !== d.day));
                                      } else {
                                        showToast('At least one operating day must be selected.');
                                      }
                                    } else {
                                      setOnboardingWorkingDays([...onboardingWorkingDays, d.day]);
                                    }
                                  }}
                                  style={{ display: 'none' }}
                                />
                                {d.label}
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Services Manager */}
                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          Services Offered & Price Menus <span style={{ color: 'var(--status-red)' }}>*</span>
                        </h4>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                          Add services that clients can book at your shop.
                        </p>

                        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                          <input 
                            type="text" 
                            placeholder="Service Name (e.g. Haircut)"
                            value={newServiceName}
                            onChange={(e) => setNewServiceName(e.target.value)}
                            style={{ flex: 2, minWidth: '160px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          />
                          <input 
                            type="number" 
                            placeholder="Price in ₹ (e.g. 150)"
                            value={newServicePrice}
                            onChange={(e) => setNewServicePrice(e.target.value)}
                            style={{ flex: 1, minWidth: '100px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          />
                          <input 
                            type="number" 
                            placeholder="Duration in mins (e.g. 20)"
                            value={newServiceDuration}
                            onChange={(e) => setNewServiceDuration(e.target.value)}
                            style={{ flex: 1, minWidth: '120px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          />
                          <select
                            value={newServiceCategory}
                            onChange={(e) => setNewServiceCategory(e.target.value as any)}
                            style={{ flex: 1.2, minWidth: '120px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          >
                            <option value="unisex">✨ Unisex</option>
                            <option value="men">🧔 Men Only</option>
                            <option value="women">👩 Women Only</option>
                          </select>
                          <button 
                            type="button" 
                            className="btn-secondary" 
                            style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                            onClick={handleAddOnboardingService}
                          >
                            <Plus size={16} /> Add
                          </button>
                        </div>

                        {/* Services list */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {onboardingServices.map((srv, idx) => (
                            <div 
                              key={idx} 
                              style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                background: 'rgba(255, 255, 255, 0.02)', 
                                border: '1px solid var(--border-light)', 
                                borderRadius: '8px', 
                                padding: '10px 16px' 
                              }}
                            >
                              <div>
                                <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{srv.name}</strong>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '12px' }}>
                                  {srv.durationMinutes} mins | <span style={{ color: 'var(--accent-gold)', textTransform: 'capitalize' }}>{srv.category || 'unisex'}</span>
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--accent-gold)', fontSize: '0.9rem' }}>
                                  ₹{srv.price}
                                </span>
                                <button 
                                  type="button" 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--status-red)', cursor: 'pointer' }}
                                  onClick={() => handleRemoveOnboardingService(idx)}
                                >
                                  <Trash size={16} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {onboardingError && (
                        <div style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                          <AlertCircle size={18} style={{ flexShrink: 0 }} />
                          <span style={{ fontWeight: 500 }}>{onboardingError}</span>
                        </div>
                      )}

                      {!isEmailVerified && !onboardingError && (
                        <div style={{ background: 'rgba(212, 175, 55, 0.08)', color: 'var(--accent-gold)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                          <AlertCircle size={16} style={{ flexShrink: 0 }} />
                          <span>Note: Click <strong>"Verify"</strong> next to your email above with the OTP before submitting.</span>
                        </div>
                      )}

                      <button 
                        type="submit" 
                        className="gold-glow-btn"
                        style={{ padding: '14px', justifyContent: 'center', width: '100%', marginTop: '10px' }}
                        disabled={submittingOnboarding}
                      >
                        {submittingOnboarding ? 'Submitting Application...' : 'Submit Partnership Application'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Check Status Tab */}
              {onboardingTab === 'status' && (
                <div>
                  <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                    <input 
                      type="email" 
                      placeholder="Enter your application email address"
                      value={onboardingEmailInput}
                      onChange={(e) => setOnboardingEmailInput(e.target.value)}
                      style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                      required
                    />
                    <button 
                      type="submit" 
                      className="gold-glow-btn" 
                      style={{ padding: '12px 20px' }}
                      disabled={checkingStatus}
                    >
                      {checkingStatus ? 'Checking...' : 'Check Status'}
                    </button>
                  </form>

                  {statusMessage && (
                    <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      {statusMessage}
                    </div>
                  )}

                  {checkedApplication && (
                    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{checkedApplication.shopName}</h4>
                        
                        {checkedApplication.status === 'approved' && (
                          <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--status-green)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            Approved
                          </span>
                        )}
                        {checkedApplication.status === 'pending' && (
                          <span style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--status-amber)', border: '1px solid rgba(251, 191, 36, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            Pending Review
                          </span>
                        )}
                        {checkedApplication.status === 'rejected' && (
                          <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                            Revisions Required
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div><strong>Owner:</strong> {checkedApplication.ownerName}</div>
                        <div><strong>Phone:</strong> {checkedApplication.contactNumber}</div>
                        <div><strong>Hours:</strong> {checkedApplication.openingTime} - {checkedApplication.closingTime}</div>
                        <div><strong>Chairs:</strong> {checkedApplication.chairsCount} Stylist Seats</div>
                      </div>

                      {checkedApplication.status === 'rejected' && (
                        <div 
                          style={{ 
                            background: 'rgba(239, 68, 68, 0.05)', 
                            border: '1px solid rgba(239, 68, 68, 0.15)', 
                            borderRadius: '8px', 
                            padding: '12px', 
                            marginTop: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <strong style={{ color: 'var(--status-red)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} /> ADMIN FEEDBACK COMMENTS:
                          </strong>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                            {checkedApplication.rejectionFeedback || 'Please review your shop details and resubmit.'}
                          </p>
                          
                          <button 
                            className="btn-danger" 
                            style={{ marginTop: '10px', padding: '10px', justifyContent: 'center', width: '100%', fontSize: '0.85rem' }}
                            onClick={() => handleEditAndResubmit(checkedApplication)}
                          >
                            <Edit size={14} style={{ marginRight: '6px' }} /> Edit Details & Resubmit
                          </button>
                        </div>
                      )}

                      {checkedApplication.status === 'approved' && (
                        <div 
                          style={{ 
                            background: 'rgba(56, 189, 248, 0.05)', 
                            border: '1px solid rgba(56, 189, 248, 0.15)', 
                            borderRadius: '8px', 
                            padding: '16px', 
                            marginTop: '8px',
                            textAlign: 'center'
                          }}
                        >
                          <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            Congratulations! Your shop has been approved. Your login credentials and password have been sent to your email.
                            <br />Email: <strong>{checkedApplication.email}</strong>
                          </p>
                          <button 
                            className="gold-glow-btn"
                            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                            onClick={() => {
                              setShowOnboardingModal(false);
                              setEmail(checkedApplication.email);
                              setPassword('');
                              setIsSignup(false);
                              setShowLoginModal(true);
                            }}
                          >
                            Proceed to Log In
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // LOGGED-IN VIEW SHELL
  // ==========================================
  return (
    <div ref={mainRef} className="animate-fade-in" style={{ paddingBottom: '100px' }}>
      
      {/* ==========================================
         DEMO BANNER / ROLE INDICATOR / DUAL THEME TOGGLE
         ========================================== */}
      <div className="role-banner">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Scissors size={18} style={{ color: 'var(--accent-gold)' }} />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
            BARBO BHOPAL
          </span>
        </div>
        
        <div className="role-banner-controls">
          
          {/* Day & Night Sliding Toggle */}
          <div className="theme-switch-container">
            {isLightMode ? <Sun size={15} style={{ color: 'var(--accent-gold)' }} /> : <Moon size={15} style={{ color: 'var(--text-secondary)' }} />}
            <label className="theme-switch">
              <input 
                type="checkbox" 
                checked={isLightMode}
                onChange={handleToggleTheme}
              />
              <span className="theme-slider"></span>
            </label>
          </div>

          <div className="role-banner-user-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRight: '1px solid var(--border-light)', paddingRight: '16px', marginRight: '4px' }}>
            <User size={14} style={{ color: 'var(--accent-gold)' }} />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {currentUser.name}
            </span>
            <span className="badge badge-gold" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
              {currentUser.role}
            </span>
          </div>

          <button 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px', marginRight: '8px' }}
            onClick={() => {
              setShowChangePasswordModal(true);
              setChangePasswordError('');
              setChangePasswordSuccess('');
            }}
          >
            <Lock size={12} /> Change Password
          </button>

          <button 
            className="btn-secondary" 
            style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            onClick={logout}
          >
            <LogOut size={12} /> Log Out
          </button>
        </div>
      </div>

      {/* ==========================================
         CUSTOMER PORTAL VIEW
         ========================================== */}
      {currentUser.role === 'customer' && (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          
          {/* Brand Localization Hero */}
          <div className="gsap-hero" style={{ textAlign: 'center', marginBottom: '50px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--accent-gold)', marginBottom: '12px' }}>
              <Sparkles size={16} />
              <span className="badge badge-gold">Bhopal's Premium Barber Network</span>
            </div>
            <h1 style={{ fontSize: 'var(--hero-title-size, 3rem)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text-primary)' }}>
              Find Your <span style={{ color: 'var(--accent-gold)' }}>Barber</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--hero-subtitle-size, 1.1rem)', marginTop: '12px', maxWidth: '600px', margin: '12px auto 0' }}>
              Book premium haircuts, straight razor wet shaves, and traditional herbal champis in <strong>Jinsi & Jahangirabad, Bhopal</strong>.
            </p>
          </div>

          {!isLocationGranted ? (
            /* Glassmorphic Geolocation Scanner Authorization Sweep overlay */
            <div className="glass-card gsap-card" style={{ maxWidth: '580px', margin: '40px auto 40px', padding: '40px 30px', textAlign: 'center' }}>
              {!isScanning ? (
                <>
                  <div style={{ display: 'inline-flex', padding: '16px', background: 'var(--accent-gold-glow)', borderRadius: '50%', color: 'var(--accent-gold)', marginBottom: '20px' }}>
                    <Compass size={32} className="pulse-alert" />
                  </div>
                  <h2 style={{ fontSize: '1.8rem', marginBottom: '12px' }}>Precision Telemetry Radar</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '30px' }}>
                    BARBO Jinsi & Jahangirabad requires precision locator authorization to identify premium styling salons near you, calculate road segment routing, and compute live travel telemetry maps.
                  </p>
                  <button 
                    className="gold-glow-btn animate-pulse" 
                    style={{ padding: '14px 28px', fontSize: '1rem', width: '100%', justifyContent: 'center' }}
                    onClick={() => setIsScanning(true)}
                  >
                    Allow Location & Run Scanner
                  </button>
                </>
              ) : (
                <>
                  {/* Concentric Sweeping radar visualizer */}
                  <div className="radar-scanner-container" style={{ marginBottom: '30px' }}>
                    <div className="radar-sweep-line"></div>
                    <div className="radar-ring radar-ring-1"></div>
                    <div className="radar-ring radar-ring-2"></div>
                    <div className="radar-ring radar-ring-3"></div>
                    <Scissors size={28} style={{ color: 'var(--accent-gold)', zIndex: 10 }} />
                  </div>
                  <h3 style={{ fontSize: '1.4rem', marginBottom: '8px' }}>Scanning Jinsi & Jahangirabad...</h3>
                  
                  {/* Dynamic ticking tracker logs */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', marginTop: '16px' }}>
                    <p style={{ color: 'var(--accent-gold)', fontWeight: 600, fontSize: '0.9rem', minHeight: '24px' }}>
                      {scanStatus}
                    </p>
                    
                    {/* Animated scanning progress bar */}
                    <div style={{ width: '180px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden', marginTop: '10px' }}>
                      <div 
                        style={{ 
                          height: '100%', 
                          width: `${(scanStep + 1) * 20}%`, 
                          background: 'var(--accent-gold)', 
                          transition: 'width 0.4s ease-in-out' 
                        }}
                      ></div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Premium Locality Geocoder Search Card */}
              <div className="glass-card gsap-card animate-slide-up" style={{ marginBottom: '36px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Change Your Location / Locality
                </span>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  if (!searchQuery.trim()) return;
                  setIsSearchingAddress(true);
                  setSearchError('');
                  
                  const queryLower = searchQuery.toLowerCase().trim();
                  let resolved = null;
                  
                  // Check local pre-compiled coordinate dictionary first
                  for (const key of Object.keys(LOCAL_BHOPAL_COORDS)) {
                    if (queryLower.includes(key)) {
                      resolved = LOCAL_BHOPAL_COORDS[key];
                      break;
                    }
                  }
                  
                  if (resolved) {
                    try {
                      setUserCoordinates({ lat: resolved.lat, lng: resolved.lon });
                      await fetchLocalBarbers(resolved.lat, resolved.lon, resolved.display);
                      setSearchQuery('');
                    } catch (err) {
                      setSearchError('Failed to load local shops around resolved coordinates.');
                    } finally {
                      setIsSearchingAddress(false);
                    }
                    return;
                  }
                  
                  try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery + ', Bhopal')}`);
                    if (!res.ok) throw new Error('Geocoder service offline');
                    const data = await res.json();
                    if (data && data.length > 0) {
                      const first = data[0];
                      const lat = Number(first.lat);
                      const lon = Number(first.lon);
                      const displayName = first.display_name.split(',')[0] + ', Bhopal';
                      setUserCoordinates({ lat, lng: lon });
                      await fetchLocalBarbers(lat, lon, displayName);
                      setSearchQuery('');
                    } else {
                      setSearchError('No matching locality found in Bhopal. Try searching other neighborhoods like Indrapuri, MP Nagar, or Jahangirabad.');
                    }
                  } catch (err) {
                    setSearchError('Search failed. Please check your network connection.');
                  } finally {
                    setIsSearchingAddress(false);
                  }
                }} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }} className="location-form">
                  <div style={{ position: 'relative', flex: 1, minWidth: '240px' }} className="location-search-wrapper">
                    <Search size={16} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Search any locality in Bhopal (e.g. Indrapuri, Chaar Batti Choraha)..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ 
                        width: '100%', 
                        padding: '12px 16px 12px 42px', 
                        background: 'var(--bg-tertiary)', 
                        border: '1px solid var(--border-light)', 
                        borderRadius: '12px', 
                        color: 'var(--text-primary)', 
                        outline: 'none', 
                        fontSize: '0.95rem' 
                      }} 
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="location-update-btn gold-glow-btn"
                    disabled={isSearchingAddress}
                    style={{ padding: '12px 24px', fontSize: '0.9rem', justifyContent: 'center' }}
                  >
                    {isSearchingAddress ? 'Searching...' : 'Update Location'}
                  </button>
                  <button 
                    type="button" 
                    className="location-share-btn btn-secondary"
                    onClick={handleShareLocation}
                    disabled={isSearchingAddress}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '0.9rem', border: '1px solid var(--accent-gold-glow)' }}
                  >
                    <Compass size={16} className={isSearchingAddress ? 'pulse-alert' : ''} style={{ color: 'var(--accent-gold)' }} />
                    <span>Share Geolocation</span>
                  </button>
                </form>

                {searchError && (
                  <div style={{ color: 'var(--status-red)', fontSize: '0.8rem', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={14} />
                    <span>{searchError}</span>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <MapPin size={14} style={{ color: 'var(--accent-gold)' }} />
                  <span>Active Location Area: <strong>{locationName}</strong></span>
                  {locationName !== 'Jahangirabad, Bhopal' && (
                    <button 
                      type="button" 
                      onClick={() => resetBarbersToDefault()}
                      style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      Reset to Default
                    </button>
                  )}
                </div>
              </div>

                  {/* Unreviewed Completed Appointments - Rate your Barber Prompt */}
                  {appointments
                    .filter(app => app.customerId === currentUser.id && app.status === 'completed' && !app.reviewed)
                    .map(app => (
                      <ReviewPrompt key={app.id} app={app} submitReview={submitReview} onSuccess={showToast} />
                    ))}

                  {/* Real-time Delay & Active Appointments Section */}
                  {appointments.filter(app => app.customerId === currentUser.id && (app.status === 'upcoming' || app.status === 'in_progress') && !isAppointmentExpired(app)).length > 0 && (
                    <div style={{ marginBottom: '50px' }}>
                      <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={20} style={{ color: 'var(--accent-gold)' }} />
                        Your Upcoming Bookings
                      </h2>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--grid-min-width, 360px), 1fr))', gap: '24px' }}>
                        {sortUpcomingAppointments(appointments
                          .filter((app) => app.customerId === currentUser.id && (app.status === 'upcoming' || app.status === 'in_progress') && !isAppointmentExpired(app)))
                          .map((app) => {
                        const barberData = barbers.find((b) => b.id === app.barberId);
                        const isDelayed = barberData && barberData.delayStatus !== 'On Time';
                        
                        return (
                          <div key={app.id} className="glass-card gsap-card" style={{ borderColor: isDelayed ? 'var(--status-amber)' : 'var(--border-light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                              <div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                  <span className="badge badge-gold">
                                    Pay At Shop
                                  </span>
                                  <span className={`badge ${app.status === 'in_progress' ? 'badge-amber pulse-alert' : 'badge-gold'}`}>
                                    {app.status === 'in_progress' ? 'In Progress' : app.status}
                                  </span>
                                </div>
                                <h3 style={{ fontSize: '1.25rem' }}>{app.barberName}</h3>
                              </div>
                            </div>
                            
                            {/* Real-time Delay Alert status */}
                            {barberData && (
                              <span className={`badge ${isDelayed ? 'badge-amber pulse-alert' : 'badge-green'}`}>
                                {barberData.delayStatus === 'On Time' ? 'Barber On Time' : `Delay: ${barberData.delayStatus}`}
                              </span>
                            )}
                             {/* Secure Check-in OTP Box */}
                             {(() => {
                                const [y, m, d] = app.date.split('-').map(Number);
                                const [endH, endM] = app.endTime.split(':').map(Number);
                                const slotEndTime = new Date(y, m - 1, d, endH, endM, 0);
                                const isPastSlot = new Date().getTime() > slotEndTime.getTime();
                                
                                const showOtp = !isPastSlot && isOtpVisible(app.date, app.startTime);
                                return (
                                  <div style={{ 
                                    background: isPastSlot ? 'rgba(239, 68, 68, 0.04)' : showOtp ? 'var(--accent-gold-glow)' : 'rgba(255, 255, 255, 0.02)', 
                                    border: `1.5px dashed ${isPastSlot ? 'var(--status-red)' : showOtp ? 'var(--accent-gold)' : 'var(--border-color)'}`, 
                                    borderRadius: '10px', 
                                    padding: '12px', 
                                    textAlign: 'center', 
                                    marginBottom: '16px' 
                                  }}>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                                      Secure Check-in OTP
                                    </span>
                                    <strong style={{ 
                                      fontSize: isPastSlot ? '1.2rem' : showOtp ? '1.5rem' : '1.1rem', 
                                      letterSpacing: showOtp ? '4px' : '0px', 
                                      color: isPastSlot ? 'var(--status-red)' : showOtp ? 'var(--accent-gold)' : 'var(--text-muted)', 
                                      display: 'block', 
                                      margin: '4px 0' 
                                    }}>
                                      {isPastSlot ? '⏳ Expired' : showOtp ? app.travelOtp : '🔒 Locked'}
                                    </strong>
                                    <span style={{ fontSize: '0.75rem', color: isPastSlot ? 'var(--status-red)' : 'var(--text-muted)' }}>
                                      {isPastSlot ? 'This booking slot has passed away and the OTP is expired.' : showOtp ? 'Share this with your barber upon arrival to start the service.' : 'Unlocks 45 minutes before your scheduled slot.'}
                                    </span>
                                  </div>
                                );
                              })()}

                            {/* Booking Schedule Details */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={14} style={{ color: 'var(--accent-gold)' }} />
                                <span>Date: {app.date}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={14} style={{ color: 'var(--accent-gold)' }} />
                                <span>Time: <strong>{app.startTime} - {app.endTime}</strong> ({app.totalDuration} mins)</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Scissors size={14} style={{ color: 'var(--accent-gold)' }} />
                                <span>Services: {app.services.map((s: any) => s.name).join(', ')}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1.05rem' }}>₹</span>
                                <span>Total Price: <strong>₹{app.totalPrice}</strong> <span style={{ fontSize: '0.8rem', color: app.paymentStatus === 'paid' ? 'var(--status-green)' : 'var(--text-muted)' }}>({app.paymentStatus === 'paid' ? 'Paid Online' : 'Pay at salon'})</span></span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '4px' }}>
                                <MapPin size={14} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: '2px' }} />
                                <span style={{ fontSize: '0.8rem', lineHeight: '1.3' }}>{barberData?.location}</span>
                              </div>
                            </div>

                            {/* Action - Cancel & Google Maps Navigation */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                              <div style={{ display: 'flex', gap: '12px', width: '100%', flexWrap: 'wrap' }} className="booking-card-actions">
                                <button 
                                  className="btn-secondary" 
                                  style={{ flex: 1, minWidth: '80px', padding: '10px', fontSize: '0.85rem' }}
                                  onClick={() => {
                                    setCancellingApp(app);
                                    setCancelReasonOption('');
                                    setCancelReasonText('');
                                  }}
                                >
                                  Cancel
                                </button>

                                  {app.status === 'upcoming' && (() => {
                                    const schedOpen = canReschedule(app.date, app.startTime);
                                    return (
                                      <button 
                                        className="btn-secondary" 
                                        style={{ 
                                          flex: 1, 
                                          minWidth: '90px', 
                                          padding: '10px', 
                                          fontSize: '0.85rem',
                                          opacity: schedOpen ? 1 : 0.5,
                                          cursor: schedOpen ? 'pointer' : 'not-allowed'
                                        }}
                                        onClick={() => {
                                          if (!schedOpen) {
                                            showToast('Modifications only allowed up to 5 minutes before scheduled start time.');
                                            return;
                                          }
                                          handleOpenReschedule(app);
                                        }}
                                      >
                                        Reschedule
                                      </button>
                                    );
                                  })()}
                                  
                                  {barberData && (
                                    <button 
                                      className="gold-glow-btn" 
                                      style={{ flex: 1.5, minWidth: '110px', padding: '10px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                                      onClick={() => setActiveMapAppId(activeMapAppId === app.id ? null : app.id)}
                                    >
                                      <Compass size={14} /> {activeMapAppId === app.id ? 'Hide Map' : 'Track Route'}
                                    </button>
                                  )}
                                </div>
                            </div>

                            {/* Integrated Telemetry Map View for Customer */}
                            {activeMapAppId === app.id && barberData && (
                              <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '20px', paddingTop: '20px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-gold)', display: 'block', marginBottom: '8px' }}>
                                  Navigation
                                </span>
                                <NavigateButton 
                                  appointment={app} 
                                  barber={barberData} 
                                />
                              </div>
                            )}

                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Barbers Grid */}
              <div style={{ marginBottom: '50px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.5rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Scissors size={20} style={{ color: 'var(--accent-gold)' }} />
                    Premium Salons & Barber Artists
                  </h2>
                  
                  {/* Segmented Category Filter Tabs */}
                  <div style={{ 
                    display: 'inline-flex', 
                    background: 'var(--bg-secondary)', 
                    padding: '4px', 
                    borderRadius: '30px', 
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-premium)'
                  }}>
                    {[
                      { id: 'all', label: '✨ All Services' },
                      { id: 'men', label: '🧔 Men\'s Grooming' },
                      { id: 'women', label: '👩 Women\'s Styling' }
                    ].map((tab) => {
                      const isActive = activeGenderFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveGenderFilter(tab.id as any);
                          }}
                          style={{
                            padding: '8px 16px',
                            borderRadius: '24px',
                            border: 'none',
                            background: isActive ? 'var(--accent-gold)' : 'transparent',
                            color: isActive ? '#000000' : 'var(--text-secondary)',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            outline: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: isActive ? '0 4px 10px rgba(197, 168, 128, 0.25)' : 'none'
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--grid-min-width, 360px), 1fr))', gap: '24px' }}>
                  {sortedBarbers.filter(barber => isBarberMatchingGender(barber, activeGenderFilter)).map((barber) => (
                    <div key={barber.id} className="glass-card gsap-card" style={{ display: 'flex', flexDirection: 'column' }}>
                      
                      {/* Photo & Basic Details */}
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                        <img 
                          src={barber.imageUrl} 
                          alt={barber.name} 
                          style={{ width: '80px', height: '80px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent-gold)' }}
                        />
                        <div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{barber.name}</h3>
                          <p style={{ color: 'var(--accent-gold)', fontSize: '0.85rem', fontWeight: 600 }}>{barber.title}</p>
                          
                          {/* Star Rating */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
                            <Star size={14} fill="var(--accent-gold)" style={{ color: 'var(--accent-gold)' }} />
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{barber.rating}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>({barber.reviewsCount} reviews)</span>
                          </div>
                        </div>
                      </div>

                      {/* Specialty & Bhopal Location */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88rem', marginBottom: '16px', color: 'var(--text-secondary)' }}>
                        <p><strong>Specialty:</strong> {barber.specialty}</p>
                        <p style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '0.82rem', marginTop: '4px' }}>
                          <MapPin size={12} style={{ color: 'var(--accent-gold)', flexShrink: 0, marginTop: '3px' }} />
                          {barber.mapsUrl ? (
                            <a 
                              href={barber.mapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              style={{ 
                                color: 'var(--text-secondary)', 
                                textDecoration: 'none',
                                transition: 'color 0.2s ease'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-gold)'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {barber.location}
                            </a>
                          ) : (
                            <span>{barber.location}</span>
                          )}
                        </p>
                      </div>

                      {/* Portfolio Gallery */}
                      <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                        {(barber.portfolioImages || []).slice(0, 3).map((img, i) => {
                          const isLast = i === 2;
                          const hasMore = (barber.portfolioImages || []).length > 3;
                          const moreCount = (barber.portfolioImages || []).length - 3;
                          return (
                            <div 
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                setLightboxImages(barber.portfolioImages || []);
                                setLightboxIndex(i);
                                setIsLightboxOpen(true);
                              }}
                              className="animate-hover"
                              style={{ 
                                flex: 1, 
                                height: '70px', 
                                borderRadius: '8px', 
                                overflow: 'hidden', 
                                border: '1px solid var(--border-light)', 
                                position: 'relative',
                                cursor: 'pointer'
                              }}
                            >
                              <img 
                                src={img}
                                alt="work portfolio"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                              {isLast && hasMore && (
                                <div 
                                  style={{ 
                                    position: 'absolute', 
                                    inset: 0, 
                                    background: 'rgba(0, 0, 0, 0.65)', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center', 
                                    color: '#fff', 
                                    fontWeight: 'bold', 
                                    fontSize: '0.95rem' 
                                  }}
                                >
                                  +{moreCount}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Live Status indicator */}
                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid var(--border-light)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-Time Status</span>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: barber.delayStatus === 'On Time' ? 'var(--status-green)' : 'var(--status-amber)' }}>
                            ● {barber.delayStatus === 'On Time' ? 'On Time' : `Delay: ${barber.delayStatus}`}
                          </span>
                        </div>
                        
                        <button 
                          className="gold-glow-btn"
                          onClick={() => handleOpenBooking(barber)}
                        >
                          Book Now <ChevronRight size={16} />
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {appointments.filter(app => app.customerId === currentUser.id && (app.status === 'completed' || app.status === 'cancelled' || isAppointmentExpired(app))).length > 0 && (
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
                    Your Cut History
                  </h2>
                  <div className="glass-card gsap-card" style={{ padding: '0 24px' }}>
                    {sortPastAppointments(appointments
                      .filter((app) => app.customerId === currentUser.id && (app.status === 'completed' || app.status === 'cancelled' || isAppointmentExpired(app))))
                      .map((app, i) => (
                        <div 
                          key={app.id} 
                          className="history-item"
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            padding: '20px 0', 
                            borderBottom: i === appointments.length - 1 ? 'none' : '1px solid var(--border-light)'
                          }}
                        >
                          <div>
                            <h4 style={{ fontSize: '1.05rem' }}>{app.services.map((s: any) => s.name).join(' + ')}</h4>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                              Barber: {app.barberName} • Date: {app.date} • Time: {app.startTime}
                            </p>
                            {app.status === 'cancelled' && app.travelStatus && app.travelStatus.startsWith('Cancelled: ') && (
                              <p style={{ fontSize: '0.8rem', color: 'var(--status-red)', marginTop: '4px', fontStyle: 'italic' }}>
                                Reason: {app.travelStatus.replace('Cancelled: ', '')}
                              </p>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} className="history-item-right">
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                              <span style={{ fontWeight: 700, color: 'var(--accent-gold)' }}>₹{app.totalPrice}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                Pay at Shop
                              </span>
                            </div>
                            <span className={`badge ${
                              app.status === 'completed' 
                                ? 'badge-gold' 
                                : app.status === 'cancelled' 
                                  ? 'badge-red' 
                                  : 'badge-red'
                            }`}>
                              {app.status === 'completed' 
                                ? 'completed' 
                                : app.status === 'cancelled' 
                                  ? (app.paymentStatus === 'refunded' ? 'Refunded' : 'cancelled') 
                                  : 'expired'}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

        </main>
      )}

      {/* ==========================================
         BARBER PORTAL VIEW
         ========================================== */}
      {currentUser.role === 'barber' && (
        <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
          
          {/* Barber Header Info */}
          <div className="gsap-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginBottom: '40px' }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
              <img 
                src={activeBarber.imageUrl} 
                alt={activeBarber.name} 
                style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--accent-gold)' }}
              />
              <div>
                <span className="badge badge-gold" style={{ marginBottom: '8px' }}>Barber Portal (Bhopal)</span>
                <h1 style={{ fontSize: '2.2rem' }}>Welcome Back, {activeBarber.name}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Shop: <strong>{activeBarber.location.split(',')[0]}</strong></p>
              </div>
            </div>

            {/* Metrics cards */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }} className="barber-metrics-container">
              <div className="glass-card" style={{ padding: '16px 24px', textAlign: 'center', minWidth: '130px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily Earnings</span>
                <h3 style={{ fontSize: '1.6rem', color: 'var(--accent-gold)', marginTop: '4px' }}>₹{dailyEarnings}</h3>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Collected at shop</span>
              </div>
              <div className="glass-card" style={{ padding: '16px 24px', textAlign: 'center', minWidth: '130px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Completed cuts</span>
                <h3 style={{ fontSize: '1.6rem', color: 'var(--text-primary)', marginTop: '4px' }}>{completedBookings.length}</h3>
              </div>
              <div className="glass-card" style={{ padding: '16px 24px', textAlign: 'center', minWidth: '130px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Rating</span>
                <h3 style={{ fontSize: '1.6rem', color: 'var(--accent-gold)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                  {activeBarber.rating} <Star size={16} fill="var(--accent-gold)" style={{ color: 'var(--accent-gold)' }} />
                </h3>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'var(--barber-grid-cols, 3fr 2fr)', gap: 'var(--barber-grid-gap, 40px)', alignItems: 'start' }} className="barber-dashboard-layout">
            
            {/* Appointment Timeline */}
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={20} style={{ color: 'var(--accent-gold)' }} />
                Active Schedule & Bookings
              </h2>
              
              {sortedBarberBookings.length === 0 ? (
                <div className="glass-card gsap-card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Scissors size={40} style={{ marginBottom: '16px', opacity: 0.5 }} />
                  <p>No bookings scheduled yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {sortedBarberBookings.map((app) => (
                    <div 
                      key={app.id} 
                      className="glass-card gsap-card"
                      style={{ 
                        opacity: (app.status === 'completed' || app.status === 'cancelled' || isAppointmentExpired(app)) ? 0.6 : 1,
                        borderColor: (app.status === 'completed' || app.status === 'cancelled' || isAppointmentExpired(app)) ? 'var(--border-light)' : 'var(--border-subtle)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>APPOINTMENT DATE & TIME</span>
                          <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>{app.date} • {app.startTime} - {app.endTime}</strong>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: '12px' }}>({app.totalDuration} mins)</span>
                        </div>
                        <div>
                          <span className={`badge ${
                            isAppointmentExpired(app) && app.status !== 'completed' && app.status !== 'cancelled'
                              ? 'badge-red'
                              : app.status === 'upcoming' 
                                ? 'badge-gold' 
                                : app.status === 'completed' 
                                  ? 'badge-green' 
                                  : 'badge-red'
                          }`}>
                            {isAppointmentExpired(app) && app.status !== 'completed' && app.status !== 'cancelled'
                              ? 'expired'
                              : app.status}
                          </span>
                        </div>
                      </div>

                      {app.status === 'cancelled' && app.travelStatus && app.travelStatus.startsWith('Cancelled: ') && (
                        <div style={{ 
                          background: 'rgba(239, 68, 68, 0.08)', 
                          border: '1px solid rgba(239, 68, 68, 0.15)', 
                          borderRadius: '10px', 
                          padding: '12px', 
                          marginBottom: '16px',
                          color: 'var(--status-red)',
                          fontSize: '0.85rem'
                        }}>
                          <strong>Appointment Cancelled:</strong> {app.travelStatus.replace('Cancelled: ', '')}
                          {app.paymentStatus === 'refunded' && (
                            <span style={{ display: 'block', marginTop: '4px', fontWeight: 600, color: 'var(--status-green)' }}>
                              ✓ UPI Pre-payment Refunded (₹{app.totalPrice})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Barber Transit Ticker */}
                      {app.notifications && app.notifications.length > 0 && (
                        <div style={{ 
                          background: 'var(--bg-tertiary)', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: '10px', 
                          padding: '12px', 
                          margin: '12px 0 16px 0',
                          maxHeight: '100px',
                          overflowY: 'auto'
                        }}>
                          <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', textTransform: 'uppercase', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                            Customer Travel Status Ticker
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {app.notifications.map((notif: string, idx: number) => (
                              <div key={idx} style={{ fontSize: '0.75rem', color: 'var(--text-primary)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <span style={{ color: 'var(--status-green)' }}>●</span>
                                <span>{notif}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', margin: '16px 0', padding: '16px 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }} className="barber-appointment-details">
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Customer</span>
                          <p style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <User size={14} style={{ color: 'var(--accent-gold)' }} /> {app.customerName}
                          </p>
                        </div>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Requested Services</span>
                          <p style={{ fontSize: '0.9rem' }}>{app.services.map(s => s.name).join(', ')}</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Subtotal</span>
                          <span style={{ display: 'block', fontSize: '1.2rem', fontWeight: 700, color: 'var(--accent-gold)' }}>
                            ₹{app.totalPrice} <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>(Collect Cash/UPI)</span>
                          </span>
                        </div>
                        
                        {app.status === 'upcoming' && !isAppointmentExpired(app) && (
                          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <button 
                                className="btn-secondary"
                                style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                                onClick={() => {
                                  setCancellingApp(app);
                                  setCancelReasonOption('');
                                  setCancelReasonText('');
                                }}
                              >
                                Cancel
                              </button>
                                <button 
                                   className="gold-glow-btn"
                                   style={{ 
                                     padding: '8px 16px', 
                                     fontSize: '0.8rem',
                                     opacity: isCheckInWindowOpen(app.date, app.startTime, app.endTime) ? 1 : 0.5,
                                     cursor: isCheckInWindowOpen(app.date, app.startTime, app.endTime) ? 'pointer' : 'not-allowed'
                                   }}
                                   onClick={() => {
                                     if (!isCheckInWindowOpen(app.date, app.startTime, app.endTime)) {
                                       showToast('Check-in is only allowed within 30 minutes of scheduled start time.');
                                       return;
                                     }
                                     setActiveOtpApp(app);
                                     setOtpInput('');
                                     setOtpError('');
                                     setOtpSuccess(false);
                                   }}
                                 >
                                   Start Service (OTP)
                                  </button>
                          </div>
                        )}

                        {app.status === 'in_progress' && (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button 
                              className="gold-glow-btn"
                              style={{ padding: '8px 16px', fontSize: '0.8rem' }}
                              onClick={async () => {
                                const res = await completeAppointment(app.id);
                                if (res.success) {
                                  showToast('Service completed successfully!');
                                } else {
                                  alert(res.message);
                                }
                              }}
                            >
                              Complete Service
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Live Telemetry Tracking Map inside Barber Console */}
                      {app.status === 'upcoming' && !isAppointmentExpired(app) && (
                        <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '16px', paddingTop: '16px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-gold)', display: 'block', marginBottom: '8px' }}>
                            Customer Navigation Status
                          </span>
                          <NavigateButton 
                            appointment={app} 
                            barber={activeBarber} 
                            hideButton={true}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column (Delay Console & Shop settings) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', position: 'sticky', top: '90px', alignSelf: 'start', width: '100%' }} className="barber-right-column">
              
              {/* Barber Status Delay Panel */}
              <div className="glass-card gsap-card barber-status-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <AlertCircle size={20} style={{ color: 'var(--accent-gold)' }} />
                  <h2 style={{ fontSize: '1.3rem' }}>Live Delay Console</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Are you running behind schedule? Adjust your status below. Your changes will propagate in real-time to alert all upcoming customer appointments.
                </p>

                {/* Status Display badge */}
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', textAlign: 'center', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block' }}>YOUR CURRENT LIVE STATUS</span>
                  <strong style={{ fontSize: '1.25rem', color: activeBarber.delayStatus === 'On Time' ? 'var(--status-green)' : 'var(--status-amber)' }}>
                    ● {activeBarber.delayStatus}
                  </strong>
                </div>

                {/* Status Selector Controls */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {[
                    { label: 'On Time', style: 'btn-secondary', val: 'On Time' },
                    { label: '+10 Minutes Late', style: 'btn-secondary', val: '+10 Min' },
                    { label: '+20 Minutes Late', style: 'btn-secondary', val: '+20 Min' },
                    { label: 'Severe Delay', style: 'btn-secondary', val: 'Delayed' },
                  ].map((btn, idx) => {
                    const isActive = activeBarber.delayStatus === btn.val;
                    return (
                      <button 
                        key={idx}
                        onClick={() => {
                          updateBarberDelay(activeBarber.id, btn.val);
                          showToast(`Status updated: ${btn.label}`);
                        }}
                        className={isActive ? 'gold-glow-btn' : 'btn-secondary'}
                        style={{ justifyContent: 'center', padding: '10px 0' }}
                      >
                        {btn.label} {isActive && '✓'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Shop settings & Operating Hours Panel */}
              <div className="glass-card gsap-card barber-settings-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Settings size={20} style={{ color: 'var(--accent-gold)' }} />
                  <h2 style={{ fontSize: '1.3rem' }}>Shop settings & Hours</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Change operating timings, weekly schedule off days, or update your Google Maps shop location link.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Shop Tagline */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Shop Tagline / Slogan</label>
                    <input 
                      type="text" 
                      value={settingsTagline}
                      onChange={(e) => setSettingsTagline(e.target.value)}
                      placeholder="e.g. Premium Professional Grooming"
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Active Barbers/Stylists Count (True Capacity) */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Active Stylists / Barbers on duty (True Slot Capacity)</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <input 
                        type="range" 
                        min="1" 
                        max="20" 
                        value={settingsCapacity}
                        onChange={(e) => setSettingsCapacity(Number(e.target.value))}
                        style={{ flexGrow: 1, accentColor: 'var(--accent-gold)' }}
                      />
                      <span style={{ fontSize: '0.9rem', color: 'var(--accent-gold)', fontWeight: 600, minWidth: '70px', textAlign: 'right' }}>
                        {settingsCapacity} Stylist{settingsCapacity > 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      This dynamically updates the slot booking limit so offline walk-ins & online bookings don't double-book your shop's staff.
                    </span>
                  </div>

                  {/* Hours Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Opening Time</label>
                      <input 
                        type="time" 
                        value={settingsOpeningTime}
                        onChange={(e) => setSettingsOpeningTime(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Closing Time</label>
                      <input 
                        type="time" 
                        value={settingsClosingTime}
                        onChange={(e) => setSettingsClosingTime(e.target.value)}
                        style={{ width: '100%', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                      />
                    </div>
                  </div>

                  {/* Weekly Days selection */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Weekly Operating Days</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {[
                        { day: 'Mon', label: 'Mon' },
                        { day: 'Tue', label: 'Tue' },
                        { day: 'Wed', label: 'Wed' },
                        { day: 'Thu', label: 'Thu' },
                        { day: 'Fri', label: 'Fri' },
                        { day: 'Sat', label: 'Sat' },
                        { day: 'Sun', label: 'Sun' },
                      ].map((d) => {
                        const isChecked = settingsWorkingDays.includes(d.day);
                        return (
                          <label 
                            key={d.day} 
                            style={{ 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px', 
                              padding: '6px 10px', 
                              background: isChecked ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg-tertiary)', 
                              border: isChecked ? '1px solid var(--accent-gold)' : '1px solid var(--border-light)', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              color: isChecked ? 'var(--accent-gold)' : 'var(--text-secondary)',
                              userSelect: 'none',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  if (settingsWorkingDays.length > 1) {
                                    setSettingsWorkingDays(settingsWorkingDays.filter(day => day !== d.day));
                                  } else {
                                    showToast('At least one operating day must be selected.');
                                  }
                                } else {
                                  setSettingsWorkingDays([...settingsWorkingDays, d.day]);
                                }
                              }}
                              style={{ display: 'none' }}
                            />
                            {d.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Maps URL */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>Google Maps URL</label>
                    <input 
                      type="text" 
                      value={settingsMapsUrl}
                      onChange={(e) => setSettingsMapsUrl(e.target.value)}
                      placeholder="Paste your new shop map link"
                      style={{ width: '100%', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  {/* Reason for location change (Only if maps URL changed) */}
                  {settingsMapsUrl.trim().toLowerCase() !== (activeBarber?.mapsUrl || '').trim().toLowerCase() && (
                    <div style={{ marginTop: '12px' }} className="animate-fade-in">
                      <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--accent-gold)', marginBottom: '6px', fontWeight: 600 }}>
                        Reason for Location Change * (Requires Admin Approval)
                      </label>
                      <textarea
                        value={locationChangeReason}
                        onChange={(e) => setLocationChangeReason(e.target.value)}
                        placeholder="e.g. Relocating to a larger space with more seats."
                        rows={3}
                        style={{ width: '100%', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.85rem', resize: 'none' }}
                        required
                      />
                    </div>
                  )}

                  {/* Save button */}
                  <button 
                    type="button" 
                    className="gold-glow-btn"
                    style={{ justifyContent: 'center', padding: '12px 0', width: '100%', marginTop: '8px' }}
                    disabled={isSavingSettings}
                    onClick={async () => {
                      if (!settingsOpeningTime || !settingsClosingTime || !settingsMapsUrl.trim()) {
                        showToast('Please fill in all shop settings.');
                        return;
                      }
                      
                      // Validate Google Maps Link format
                      const isGoogleMaps = (url: string) => {
                        const trimmed = url.trim();
                        if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
                          return false;
                        }
                        return /google\..*\/maps/i.test(trimmed) || 
                               /maps\.app\.goo\.gl/i.test(trimmed) || 
                               /goo\.gl\/maps/i.test(trimmed);
                      };
                      if (!isGoogleMaps(settingsMapsUrl)) {
                        showToast('Please enter a valid Google Maps link.');
                        return;
                      }

                      const isLocationChanged = settingsMapsUrl.trim().toLowerCase() !== (activeBarber?.mapsUrl || '').trim().toLowerCase();
                      if (isLocationChanged && !locationChangeReason.trim()) {
                        showToast('Reason for location change is required.');
                        return;
                      }

                      setIsSavingSettings(true);
                      
                      // Parse coordinates
                      let parsedLat = activeBarber.lat;
                      let parsedLon = activeBarber.lon;
                      const placeMatch = settingsMapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
                      if (placeMatch) {
                        parsedLat = parseFloat(placeMatch[1]);
                        parsedLon = parseFloat(placeMatch[2]);
                      } else {
                        const coordMatch = settingsMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                           settingsMapsUrl.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                           settingsMapsUrl.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                           settingsMapsUrl.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
                        if (coordMatch) {
                          parsedLat = parseFloat(coordMatch[1]);
                          parsedLon = parseFloat(coordMatch[2]);
                        }
                      }

                      const res = await updateBarberSettings(activeBarber.id, {
                        openingTime: settingsOpeningTime,
                        closingTime: settingsClosingTime,
                        workingDays: settingsWorkingDays.join(','),
                        mapsUrl: settingsMapsUrl.trim(),
                        lat: parsedLat,
                        lon: parsedLon,
                        reason: isLocationChanged ? locationChangeReason.trim() : undefined,
                        title: settingsTagline.trim(),
                        chairsCount: settingsCapacity
                      });

                      setIsSavingSettings(false);

                      if (res.success) {
                        showToast(res.message || 'Settings saved successfully!');
                        if (isLocationChanged) {
                          setLocationChangeReason('');
                        }
                      } else {
                        showToast(res.message || 'Failed to save settings.');
                      }
                    }}
                  >
                    {isSavingSettings ? 'Saving Settings...' : 'Save Settings'}
                  </button>
                </div>
              </div>

              {/* Manage Shop Photos Panel */}
              <div className="glass-card gsap-card barber-photos-panel" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Image size={20} style={{ color: 'var(--accent-gold)' }} />
                  <h2 style={{ fontSize: '1.3rem' }}>Manage Shop Photos</h2>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Update your shop profile picture and manage your portfolio gallery order.
                </p>

                {/* Profile Image Section */}
                <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Shop Profile Picture</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '72px', height: '72px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--accent-gold)', flexShrink: 0, background: 'var(--bg-tertiary)' }}>
                      <img 
                        src={profileImageUrlInput || activeBarber?.imageUrl || 'https://via.placeholder.com/72?text=Shop'} 
                        alt="Profile Preview" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/72?text=Shop'; }}
                      />
                    </div>
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Upload a JPG or PNG photo of your shop (max 8 MB).
                      </p>
                      <label
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '9px 16px', borderRadius: '8px', fontSize: '0.82rem',
                          background: isUploadingProfileImage ? 'var(--bg-tertiary)' : 'var(--accent-gold)',
                          color: isUploadingProfileImage ? 'var(--text-muted)' : '#000',
                          fontWeight: 600, cursor: isUploadingProfileImage ? 'not-allowed' : 'pointer',
                          alignSelf: 'start', transition: 'all 0.2s'
                        }}
                      >
                        {isUploadingProfileImage ? '⏳ Uploading...' : '📷 Choose Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          disabled={isUploadingProfileImage}
                          onChange={handleProfileImageFileChange}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* Portfolio Gallery Section */}
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Portfolio Gallery ({(activeBarber.portfolioImages || []).length})</h3>
                  
                  {/* Grid of portfolio thumbnails */}
                  {(!activeBarber.portfolioImages || activeBarber.portfolioImages.length === 0) ? (
                    <div style={{ background: 'var(--bg-tertiary)', border: '1px dashed var(--border-light)', borderRadius: '12px', padding: '24px', textAlign: 'center', marginBottom: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                      No portfolio pictures added yet. Use the presets or add a custom URL below to showcase your salon's style.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                      {activeBarber.portfolioImages.map((imgUrl, idx) => (
                        <div 
                          key={idx} 
                          className="portfolio-thumb-card"
                          style={{ 
                            position: 'relative', 
                            background: 'var(--bg-secondary)', 
                            borderRadius: '10px', 
                            overflow: 'hidden', 
                            border: '1px solid var(--border-light)',
                            aspectRatio: '1/1',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                        >
                          <img 
                            src={imgUrl} 
                            alt={`Portfolio ${idx + 1}`} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          
                          {/* Hover Overlay Controls */}
                          <div 
                            style={{ 
                              position: 'absolute', 
                              bottom: 0, 
                              left: 0, 
                              right: 0, 
                              background: 'rgba(0, 0, 0, 0.85)', 
                              display: 'flex', 
                              justifyContent: 'space-around', 
                              alignItems: 'center', 
                              padding: '6px 0',
                              backdropFilter: 'blur(2px)'
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => handleMovePortfolioImage(idx, 'left')}
                              disabled={idx === 0}
                              style={{ background: 'none', border: 'none', color: idx === 0 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: idx === 0 ? 'default' : 'pointer', fontSize: '0.95rem', padding: '4px', display: 'flex', alignItems: 'center' }}
                              title="Move Left"
                            >
                              ←
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeletePortfolioImage(imgUrl)}
                              style={{ background: 'none', border: 'none', color: '#ff4d4d', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
                              title="Delete Photo"
                            >
                              <Trash size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMovePortfolioImage(idx, 'right')}
                              disabled={idx === activeBarber.portfolioImages.length - 1}
                              style={{ background: 'none', border: 'none', color: idx === activeBarber.portfolioImages.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: idx === activeBarber.portfolioImages.length - 1 ? 'default' : 'pointer', fontSize: '0.95rem', padding: '4px', display: 'flex', alignItems: 'center' }}
                              title="Move Right"
                            >
                              →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Portfolio Image via File Upload */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Upload a Photo from Your Device</label>
                    <label
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '8px',
                        padding: '10px 18px', borderRadius: '8px', fontSize: '0.85rem',
                        background: isUploadingPortfolio ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                        border: '1px dashed var(--accent-gold)',
                        color: isUploadingPortfolio ? 'var(--text-muted)' : 'var(--accent-gold)',
                        fontWeight: 600, cursor: isUploadingPortfolio ? 'not-allowed' : 'pointer',
                        alignSelf: 'start', transition: 'all 0.2s'
                      }}
                    >
                      {isUploadingPortfolio ? '⏳ Uploading...' : '📁 Choose & Upload Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        disabled={isUploadingPortfolio}
                        onChange={handlePortfolioFileChange}
                      />
                    </label>
                  </div>

                  {/* Curated Preset Picker */}
                  <div>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>Curated Styling Presets (Click to add instantly)</span>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                      {[
                        { title: 'Scissor Detail', url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&q=80&w=400&h=400' },
                        { title: 'Styling Station', url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&q=80&w=400&h=400' },
                        { title: 'Hair Wash Station', url: 'https://images.unsplash.com/photo-1527799863830-55347bf0c2e4?auto=format&fit=crop&q=80&w=400&h=400' },
                        { title: 'Interior Vibe', url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=400&h=400' }
                      ].map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleAddPortfolioPreset(item.url)}
                          className="preset-photo-card animate-hover"
                          style={{ 
                            position: 'relative', 
                            cursor: 'pointer', 
                            borderRadius: '8px', 
                            overflow: 'hidden', 
                            border: '1px solid var(--border-light)',
                            aspectRatio: '1/1',
                            display: 'flex'
                          }}
                          title={item.title}
                        >
                          <img 
                            src={item.url} 
                            alt={item.title} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* ==========================================
             BARBER SERVICE MANAGEMENT PANEL
             ========================================== */}
          <div className="glass-card gsap-card" style={{ marginTop: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <Scissors size={20} style={{ color: 'var(--accent-gold)' }} />
              <h2 style={{ fontSize: '1.4rem' }}>Manage Your Services</h2>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
              Add new services, update prices, or remove services from your menu. Changes reflect instantly for your customers.
            </p>

            {/* Add New Service Row */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-light)' }}>
              <input 
                type="text" 
                placeholder="New service name (e.g. Hair Spa)"
                value={portalNewServiceName}
                onChange={(e) => setPortalNewServiceName(e.target.value)}
                style={{ flex: 2, minWidth: '180px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
              />
              <input 
                type="number" 
                placeholder="Price in ₹ (e.g. 300)"
                value={portalNewServicePrice}
                onChange={(e) => setPortalNewServicePrice(e.target.value)}
                style={{ flex: 1, minWidth: '120px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
              />
              <input 
                type="number" 
                placeholder="Duration in mins (e.g. 30)"
                value={portalNewServiceDuration}
                onChange={(e) => setPortalNewServiceDuration(e.target.value)}
                style={{ flex: 1, minWidth: '140px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
              />
              <select
                value={portalNewServiceCategory}
                onChange={(e) => setPortalNewServiceCategory(e.target.value as any)}
                style={{ flex: 1.2, minWidth: '130px', padding: '10px 14px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
              >
                <option value="unisex">✨ Unisex</option>
                <option value="men">🧔 Men Only</option>
                <option value="women">👩 Women Only</option>
              </select>
              <button 
                type="button"
                className="gold-glow-btn"
                style={{ padding: '10px 20px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={async () => {
                  if (!portalNewServiceName.trim()) {
                    showToast('Please enter a service name.');
                    return;
                  }
                  const price = Number(portalNewServicePrice);
                  const duration = Number(portalNewServiceDuration);
                  if (!price || price <= 0) {
                    showToast('Please enter a valid price.');
                    return;
                  }
                  if (!duration || duration <= 0) {
                    showToast('Please enter a valid duration in minutes.');
                    return;
                  }
                  const res = await addBarberService(activeBarber.id, { name: portalNewServiceName.trim(), price, durationMinutes: duration, category: portalNewServiceCategory });
                  if (res.success) {
                    showToast(res.message);
                    setPortalNewServiceName('');
                    setPortalNewServicePrice('');
                    setPortalNewServiceDuration('');
                    setPortalNewServiceCategory('unisex');
                  } else {
                    showToast(res.message);
                  }
                }}
              >
                <Plus size={16} /> Add Service
              </button>
            </div>

            {/* Current Services List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {services.filter(s => s.barberId === activeBarber.id || !s.barberId).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No services found. Add your first service above!
                </div>
              ) : (
                services.filter(s => s.barberId === activeBarber.id || !s.barberId).map((srv) => (
                  <div 
                    key={srv.id}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      background: editingServiceId === srv.id ? 'rgba(212, 175, 55, 0.05)' : 'var(--bg-secondary)',
                      border: editingServiceId === srv.id ? '1px solid var(--accent-gold)' : '1px solid var(--border-light)',
                      borderRadius: '10px', 
                      padding: '14px 18px',
                      transition: 'all 0.2s ease',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    {editingServiceId === srv.id ? (
                      /* Inline Edit Mode */
                      <>
                        <div style={{ display: 'flex', gap: '10px', flex: 1, flexWrap: 'wrap', minWidth: '0' }}>
                          <input 
                            type="text" 
                            value={editServiceName}
                            onChange={(e) => setEditServiceName(e.target.value)}
                            style={{ flex: 2, minWidth: '140px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          />
                          <input 
                            type="number" 
                            value={editServicePrice}
                            onChange={(e) => setEditServicePrice(e.target.value)}
                            placeholder="Price ₹"
                            style={{ flex: 1, minWidth: '80px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          />
                          <input 
                            type="number" 
                            value={editServiceDuration}
                            onChange={(e) => setEditServiceDuration(e.target.value)}
                            placeholder="Mins"
                            style={{ flex: 1, minWidth: '70px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          />
                          <select
                            value={editServiceCategory}
                            onChange={(e) => setEditServiceCategory(e.target.value as any)}
                            style={{ flex: 1.2, minWidth: '110px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                          >
                            <option value="unisex">✨ Unisex</option>
                            <option value="men">🧔 Men Only</option>
                            <option value="women">👩 Women Only</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            type="button"
                            className="gold-glow-btn"
                            style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={async () => {
                              const price = Number(editServicePrice);
                              const duration = Number(editServiceDuration);
                              if (!editServiceName.trim() || price <= 0 || duration <= 0) {
                                showToast('Please fill in all fields correctly.');
                                return;
                              }
                              const res = await updateBarberService(activeBarber.id, srv.id, { name: editServiceName.trim(), price, durationMinutes: duration, category: editServiceCategory });
                              if (res.success) {
                                showToast(res.message);
                                setEditingServiceId(null);
                              } else {
                                showToast(res.message);
                              }
                            }}
                          >
                            <CheckCircle size={14} /> Save
                          </button>
                          <button 
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            onClick={() => setEditingServiceId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : (
                      /* Display Mode */
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
                          <div>
                            <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{srv.name}</strong>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '12px' }}>
                              {srv.durationMinutes} mins | <span style={{ color: 'var(--accent-gold)', textTransform: 'capitalize' }}>{srv.category || 'unisex'}</span>
                            </span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ fontWeight: 700, color: 'var(--accent-gold)', fontSize: '1rem' }}>
                            ₹{srv.price}
                          </span>
                          <button 
                            type="button"
                            style={{ background: 'transparent', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer', padding: '4px' }}
                            title="Edit service"
                            onClick={() => {
                              setEditingServiceId(srv.id);
                              setEditServiceName(srv.name);
                              setEditServicePrice(String(srv.price));
                              setEditServiceDuration(String(srv.durationMinutes));
                              setEditServiceCategory(srv.category || 'unisex');
                            }}
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            type="button"
                            style={{ background: 'transparent', border: 'none', color: 'var(--status-red)', cursor: 'pointer', padding: '4px' }}
                            title="Delete service"
                            onClick={async () => {
                              if (confirm(`Remove "${srv.name}" from your service menu?`)) {
                                const res = await deleteBarberService(activeBarber.id, srv.id);
                                if (res.success) {
                                  showToast(res.message);
                                } else {
                                  showToast(res.message);
                                }
                              }
                            }}
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </main>
      )}

      {/* ==========================================
         ADMIN PORTAL VIEW
         ========================================== */}
      {currentUser.role === 'admin' && (
        <AdminConsole showToast={showToast} logout={logout} />
      )}

      {/* ==========================================
         BOOKING SHEET MODAL
         ========================================== */}
      {isBookingOpen && selectedBarber && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsBookingOpen(false)}>
          <div 
            className="glass-card gsap-modal booking-modal-content" 
            style={{ width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Scissors size={20} style={{ color: 'var(--accent-gold)' }} />
                  {rescheduleApp ? 'Reschedule Appointment' : 'Book Appointment'}
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {rescheduleApp ? `Change scheduled time with ${selectedBarber.name}` : `Select services and time slot with ${selectedBarber.name}`}
                </p>
              </div>
              <button 
                onClick={() => setIsBookingOpen(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Error & Success Banners */}
            {bookingError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} />
                <span>{bookingError}</span>
              </div>
            )}

            {bookingSuccess && (
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', color: 'var(--status-green)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '16px', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                <CheckCircle size={30} style={{ margin: '0 auto 8px', display: 'block' }} />
                <strong>Appointment Confirmed!</strong>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Paying at shop. See you soon!</p>
              </div>
            )}

            {/* Modal Body Form */}
            <form onSubmit={handleConfirmBooking}>
              
              {/* Date Input */}
              <div 
                style={{ marginBottom: '20px' }}
                title={isTimeSelectionDisabled ? "Rescheduling is not allowed within 30 minutes of booking start" : undefined}
              >
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Select Date {isTimeSelectionDisabled && ' (Locked - within 30 mins of appointment)'}
                </label>
                <input 
                  type="date"
                  value={selectedDate}
                  min={getLocalDateString()}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedTimeSlot('');
                  }}
                  disabled={isTimeSelectionDisabled}
                  style={{ 
                    width: '100%', 
                    padding: '12px', 
                    background: 'var(--bg-tertiary)', 
                    border: '1px solid var(--border-light)', 
                    borderRadius: '10px', 
                    color: 'var(--text-primary)', 
                    outline: 'none',
                    opacity: isTimeSelectionDisabled ? 0.6 : 1,
                    cursor: isTimeSelectionDisabled ? 'not-allowed' : 'text'
                  }}
                />
              </div>

              {/* Service list checks */}
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Select Services (Select multiple)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {services
                    .filter((service) => {
                      const belongsToBarber = !service.barberId || (selectedBarber && service.barberId === selectedBarber.id);
                      if (!belongsToBarber) return false;
                      
                      if (activeGenderFilter === 'men') {
                        return service.category === 'men' || service.category === 'unisex';
                      }
                      if (activeGenderFilter === 'women') {
                        return service.category === 'women' || service.category === 'unisex';
                      }
                      return true;
                    })
                    .map((service) => {
                      const isChecked = selectedServiceIds.includes(service.id);
                      return (
                        <div 
                          key={service.id} 
                          onClick={() => handleToggleService(service.id)}
                          style={{ 
                            padding: '12px 16px', 
                            borderRadius: '10px', 
                            background: isChecked ? 'var(--accent-gold-glow)' : 'var(--bg-tertiary)', 
                            border: isChecked ? '1px solid var(--accent-gold)' : '1px solid var(--border-light)',
                            cursor: 'pointer', 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ paddingRight: '16px' }}>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: isChecked ? 'var(--accent-gold)' : 'var(--text-primary)' }}>
                              {service.name}
                            </h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              {service.description}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <span style={{ display: 'block', fontWeight: 700, color: 'var(--text-primary)' }}>
                              ₹{service.price}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {service.durationMinutes} min
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Time slot picker */}
              {selectedServiceIds.length > 0 && selectedBarber && (() => {
                const dayAbbrev = getDayOfWeekAbbreviation(selectedDate);
                const workingDays = selectedBarber.workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun';
                const workingDaysArray = workingDays.split(',').map(d => d.trim());
                const isClosed = !workingDaysArray.includes(dayAbbrev);

                if (isClosed) {
                  const dayNames: Record<string, string> = {
                    'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday',
                    'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday'
                  };
                  const fullDayName = dayNames[dayAbbrev] || dayAbbrev;
                  return (
                    <div style={{ 
                      background: 'rgba(239, 68, 68, 0.08)', 
                      color: 'var(--status-red)', 
                      border: '1px solid rgba(239, 68, 68, 0.15)', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      marginBottom: '24px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px' 
                    }}>
                      <AlertTriangle size={20} style={{ color: 'var(--status-red)', flexShrink: 0 }} />
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--status-red)' }}>Salon Closed</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>This salon is closed on {fullDayName}s. Please select another date.</span>
                      </div>
                    </div>
                  );
                }

                const slots = getDynamicTimeSlots(selectedBarber);
                if (slots.length === 0) {
                  return (
                    <div style={{ 
                      background: 'rgba(245, 158, 11, 0.08)', 
                      color: 'var(--status-amber)', 
                      border: '1px solid rgba(245, 158, 11, 0.15)', 
                      padding: '16px', 
                      borderRadius: '12px', 
                      marginBottom: '24px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '12px' 
                    }}>
                      <AlertCircle size={20} style={{ color: 'var(--status-amber)', flexShrink: 0 }} />
                      <div>
                        <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--status-amber)' }}>No Slots Available</strong>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>The selected services exceed the salon's remaining operating hours.</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      Available Time Slots (Calculated for {totalDuration} mins slot) {isTimeSelectionDisabled && ' (Locked - within 30 mins of appointment)'}
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'var(--slot-grid-cols, repeat(4, 1fr))', gap: '8px' }} className="time-slot-grid">
                      {slots.map((slot) => {
                        // Check double booking dynamic block
                        const [slotH, slotM] = slot.split(':').map(Number);
                        const slotStart = slotH * 60 + slotM;
                        const slotEnd = slotStart + totalDuration;

                        const capacity = selectedBarber.chairsCount || 2;
                        let isBooked = false;

                        for (let t = slotStart; t < slotEnd; t++) {
                          let activeOverlaps = 0;
                          for (const app of appointments) {
                            if (app.barberId !== selectedBarber.id || app.date !== selectedDate || app.status === 'cancelled' || app.status === 'completed') continue;
                            const [appSH, appSM] = app.startTime.split(':').map(Number);
                            const [appEH, appEM] = app.endTime.split(':').map(Number);
                            const appStart = appSH * 60 + appSM;
                            const appEnd = appEH * 60 + appEM;

                            if (t >= appStart && t < appEnd) {
                              activeOverlaps++;
                            }
                          }
                          if (activeOverlaps >= capacity) {
                            isBooked = true;
                            break;
                          }
                        }

                        // Check if slot is too soon or in the past (if date is today, must be at least 30 mins in the future)
                        let isTooSoon = false;
                        const localDate = new Date();
                        const y = localDate.getFullYear();
                        const m = String(localDate.getMonth() + 1).padStart(2, '0');
                        const d = String(localDate.getDate()).padStart(2, '0');
                        const todayFormatted = `${y}-${m}-${d}`;

                        if (selectedDate === todayFormatted) {
                          const [h, min] = slot.split(':').map(Number);
                          const slotTime = new Date(y, localDate.getMonth(), localDate.getDate(), h, min, 0);
                          if (slotTime.getTime() - localDate.getTime() < 30 * 60 * 1000) {
                            isTooSoon = true;
                          }
                        }

                        const isSelected = selectedTimeSlot === slot;
                        const isDisabled = isBooked || isTimeSelectionDisabled || isTooSoon;

                        const tooltipText = isTimeSelectionDisabled 
                          ? "Rescheduling is not allowed within 30 minutes of booking start" 
                          : isTooSoon 
                            ? "New bookings must be scheduled at least 30 minutes in advance" 
                            : isBooked 
                              ? "Slot fully booked" 
                              : undefined;

                        return (
                          <span 
                            key={slot} 
                            title={tooltipText} 
                            style={{ display: 'inline-block', width: '100%', cursor: isDisabled ? 'not-allowed' : 'default' }}
                          >
                            <button
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setSelectedTimeSlot(slot)}
                              style={{
                                width: '100%',
                                padding: '10px 4px',
                                borderRadius: '8px',
                                border: isSelected ? '1px solid var(--accent-gold)' : '1px solid var(--border-light)',
                                background: isSelected ? 'var(--accent-gold)' : isDisabled ? 'transparent' : 'var(--bg-tertiary)',
                                color: isSelected ? 'var(--bg-primary)' : isDisabled ? 'var(--text-muted)' : 'var(--text-primary)',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                textDecoration: isBooked ? 'line-through' : 'none',
                                opacity: isBooked ? 0.35 : isDisabled ? 0.6 : 1,
                                transition: 'all 0.2s ease',
                                pointerEvents: isDisabled ? 'none' : 'auto'
                              }}
                            >
                              {slot}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}



              {/* Running total pricing and Confirm checkout button */}
              {selectedServiceIds.length > 0 && (
                <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '10px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL PRICE</span>
                    <strong style={{ fontSize: '1.4rem', color: 'var(--accent-gold)' }}>₹{totalPrice}</strong>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>TOTAL DURATION</span>
                    <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{totalDuration} minutes</strong>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', gap: '16px' }}>
                <button 
                  type="button" 
                  className="btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => setIsBookingOpen(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="gold-glow-btn" 
                  style={{ flex: 2, justifyContent: 'center' }}
                  disabled={!selectedTimeSlot || selectedServiceIds.length === 0}
                >
                  {rescheduleApp ? 'Confirm Reschedule' : 'Confirm & Pay at Shop'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}



      {/* ==========================================
         SECURE HANDSHAKE OTP VERIFICATION MODAL
         ========================================== */}
      {activeOtpApp && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setActiveOtpApp(null)}>
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '440px', 
              padding: '32px',
              position: 'relative',
              boxShadow: 'var(--shadow-premium), var(--shadow-glow)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Close Button */}
            <button 
              onClick={() => setActiveOtpApp(null)} 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-gold-glow)', borderRadius: '50%', color: 'var(--accent-gold)', marginBottom: '16px' }}>
                <Key size={24} />
              </div>
              <h2 style={{ fontSize: '1.5rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>Secure Check-in</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Verify customer check-in OTP code to start service</p>
            </div>

            {/* Summary Box */}
            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '16px', marginBottom: '24px', fontSize: '0.88rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{activeOtpApp.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Scheduled:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{activeOtpApp.startTime} - {activeOtpApp.endTime}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Services:</span>
                <strong style={{ color: 'var(--text-primary)', textAlign: 'right', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeOtpApp.services.map((s: any) => s.name).join(', ')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '8px', marginTop: '8px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Amount Due:</span>
                <strong style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>₹{activeOtpApp.totalPrice}</strong>
              </div>
            </div>

            {otpSuccess ? (
              <div style={{ background: 'rgba(56, 189, 248, 0.08)', color: 'var(--status-green)', border: '1px solid rgba(56, 189, 248, 0.15)', padding: '16px', borderRadius: '12px', textAlign: 'center' }}>
                <CheckCircle size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                <strong>Check-in Verified!</strong>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Service check-in authorized. Service started.</p>
              </div>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setOtpError('');
                
                const res = await startAppointmentWithOtp(activeOtpApp.id, otpInput.trim());
                if (res.success) {
                  setOtpSuccess(true);
                  showToast('Service started successfully!');
                  setTimeout(() => {
                    setActiveOtpApp(null);
                    setOtpSuccess(false);
                    setOtpInput('');
                  }, 1500);
                } else {
                  setOtpError(res.message);
                  // Add shake class
                  const inputEl = document.getElementById('handshake-otp-input');
                  if (inputEl) {
                    inputEl.classList.add('shake-error');
                    setTimeout(() => {
                      inputEl.classList.remove('shake-error');
                    }, 400);
                  }
                }
              }}>
                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="handshake-otp-input" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textAlign: 'center' }}>
                    Enter 4-Digit travel OTP
                  </label>
                  <input 
                    id="handshake-otp-input"
                    type="text" 
                    placeholder="0 0 0 0" 
                    maxLength={4}
                    value={otpInput}
                    onChange={(e) => {
                      setOtpInput(e.target.value.replace(/\D/g, ''));
                      setOtpError('');
                    }}
                    autoFocus
                    style={{ 
                      width: '100%', 
                      padding: '16px', 
                      background: 'var(--bg-tertiary)', 
                      border: '1px solid var(--border-light)', 
                      borderRadius: '12px', 
                      color: 'var(--accent-gold)', 
                      outline: 'none', 
                      fontSize: '1.8rem', 
                      textAlign: 'center', 
                      letterSpacing: '8px',
                      fontWeight: 800,
                      transition: 'var(--transition-smooth)'
                    }}
                  />
                  {otpError && (
                    <span style={{ display: 'block', color: 'var(--status-red)', fontSize: '0.78rem', marginTop: '8px', textAlign: 'center' }}>
                      {otpError}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    style={{ flex: 1, padding: '12px 0' }}
                    onClick={() => setActiveOtpApp(null)}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="gold-glow-btn"
                    style={{ flex: 1.5, padding: '12px 0', justifyContent: 'center' }}
                    disabled={otpInput.length < 4}
                  >
                    Verify & Complete
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

      {/* ==========================================
          CANCELLATION REASON MODAL
          ========================================== */}
      {cancellingApp && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setCancellingApp(null)}>
          <div 
            className="glass-card" 
            style={{ 
              width: '100%', 
              maxWidth: '480px', 
              padding: '32px',
              position: 'relative',
              boxShadow: 'var(--shadow-premium), var(--shadow-glow)',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => setCancellingApp(null)} 
              style={{ position: 'absolute', right: '20px', top: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>

            {/* Modal Header */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '50%', color: 'var(--status-red)', marginBottom: '16px' }}>
                <AlertTriangle size={24} />
              </div>
              <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '-0.01em', color: 'var(--status-red)' }}>Cancel Appointment</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
                Please provide a reason for cancelling this appointment.
              </p>
            </div>

            {/* Appointment Details Preview */}
            <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '14px', marginBottom: '20px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{currentUser?.role === 'customer' ? 'Barber:' : 'Customer:'}</span>
                <strong style={{ color: 'var(--text-primary)' }}>{currentUser?.role === 'customer' ? cancellingApp.barberName : cancellingApp.customerName}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Time:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{cancellingApp.date} • {cancellingApp.startTime}</strong>
              </div>
            </div>

            {/* Reasons Form */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
                Select a reason
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                {(currentUser?.role === 'customer' ? [
                  "Change of plans",
                  "Emergency came up",
                  "Booked by mistake / wrong slot",
                  "Barber running too late"
                ] : [
                  "Personal emergency",
                  "Power outage / technical issue at shop",
                  "Double booked / scheduling conflict",
                  "Customer didn't arrive on time"
                ]).map((reason) => (
                  <label 
                    key={reason}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '12px 16px',
                      background: cancelReasonOption === reason ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                      border: `1px solid ${cancelReasonOption === reason ? 'var(--accent-gold)' : 'var(--border-light)'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      color: 'var(--text-primary)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <input 
                      type="radio" 
                      name="cancelReason" 
                      value={reason} 
                      checked={cancelReasonOption === reason} 
                      onChange={(e) => {
                        setCancelReasonOption(e.target.value);
                      }}
                      style={{ accentColor: 'var(--accent-gold)' }}
                    />
                    <span>{reason}</span>
                  </label>
                ))}

                <label 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    background: cancelReasonOption === 'other' ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                    border: `1px solid ${cancelReasonOption === 'other' ? 'var(--accent-gold)' : 'var(--border-light)'}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    color: 'var(--text-primary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input 
                    type="radio" 
                    name="cancelReason" 
                    value="other" 
                    checked={cancelReasonOption === 'other'} 
                    onChange={(e) => {
                      setCancelReasonOption(e.target.value);
                    }}
                    style={{ accentColor: 'var(--accent-gold)' }}
                  />
                  <span>Other (Write custom reason)</span>
                </label>
              </div>

              {cancelReasonOption === 'other' && (
                <div style={{ marginBottom: '24px' }} className="animate-fade-in">
                  <textarea
                    placeholder="Describe the reason for cancellation..."
                    value={cancelReasonText}
                    onChange={(e) => setCancelReasonText(e.target.value)}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  className="btn-secondary"
                  style={{ flex: 1, padding: '12px', justifyContent: 'center' }}
                  onClick={() => setCancellingApp(null)}
                >
                  Keep Booking
                </button>
                <button
                  className="btn-danger"
                  style={{ 
                    flex: 1, 
                    padding: '12px', 
                    justifyContent: 'center',
                    opacity: (!cancelReasonOption || (cancelReasonOption === 'other' && !cancelReasonText.trim())) ? 0.5 : 1,
                    cursor: (!cancelReasonOption || (cancelReasonOption === 'other' && !cancelReasonText.trim())) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={!cancelReasonOption || (cancelReasonOption === 'other' && !cancelReasonText.trim())}
                  onClick={async () => {
                    const finalReason = cancelReasonOption === 'other' ? cancelReasonText.trim() : cancelReasonOption;
                    cancelledAppIdsRef.current.add(cancellingApp.id);
                    const isPaid = cancellingApp.paymentStatus === 'paid';
                    await updateAppointmentStatus(cancellingApp.id, 'cancelled', finalReason);
                    setCancellingApp(null);
                    if (isPaid) {
                      showToast(`Appointment cancelled. Refund of ₹${cancellingApp.totalPrice} initiated!`);
                    } else {
                      showToast('Appointment cancelled successfully.');
                    }
                  }}
                >
                  Confirm Cancel
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Onboarding Form Modal */}
      {showOnboardingModal && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setShowOnboardingModal(false)}>
          <div 
            className="glass-card animate-scale-in" 
            style={{ width: '100%', maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto', zIndex: 1100 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building size={22} style={{ color: 'var(--accent-gold)' }} />
                  Partner with Barbo
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  Get your salon listed on Bhopal's premium grooming network
                </p>
              </div>
              <button 
                onClick={() => setShowOnboardingModal(false)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', marginBottom: '24px' }}>
              <button 
                onClick={() => setOnboardingTab('apply')}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: 'transparent', 
                  border: 'none', 
                  borderBottom: onboardingTab === 'apply' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                  color: onboardingTab === 'apply' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Apply for Listing
              </button>
              <button 
                onClick={() => setOnboardingTab('status')}
                style={{ 
                  flex: 1, 
                  padding: '12px', 
                  background: 'transparent', 
                  border: 'none', 
                  borderBottom: onboardingTab === 'status' ? '2px solid var(--accent-gold)' : '2px solid transparent',
                  color: onboardingTab === 'status' ? 'var(--accent-gold)' : 'var(--text-secondary)',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Check Application Status
              </button>
            </div>

            {/* Apply Tab */}
            {onboardingTab === 'apply' && (
              <div>
                {onboardingSuccess ? (
                  <div style={{ padding: '30px 20px', textAlign: 'center' }}>
                    <CheckCircle size={48} style={{ color: 'var(--accent-gold)', marginBottom: '16px', marginLeft: 'auto', marginRight: 'auto', display: 'block' }} />
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>Application Submitted!</h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px', lineHeight: '1.5' }}>
                      Thank you for applying. Our admin team will review your application within 24 hours. You can check the status anytime using your email: <strong>{onboardingEmailInput || onboardingEmail}</strong>
                    </p>
                    <button className="gold-glow-btn" onClick={() => setShowOnboardingModal(false)}>
                      Close Portal
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {onboardingError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <AlertCircle size={16} />
                        <span>{onboardingError}</span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Shop/Salon Name <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. Royal Barber Shop"
                          value={onboardingShopName}
                          onChange={(e) => setOnboardingShopName(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          required
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Owner / Main Barber Name <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="text" 
                          placeholder="e.g. Rajesh Kumar"
                          value={onboardingOwnerName}
                          onChange={(e) => setOnboardingOwnerName(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          required
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Contact Email (For logins) <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            type="email" 
                            placeholder="e.g. owner@shop.com"
                            value={onboardingEmail}
                            onChange={(e) => {
                              setOnboardingEmail(e.target.value);
                              setIsEmailVerified(false);
                              setShowOtpInput(false);
                            }}
                            disabled={isEmailVerified}
                            style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                            required
                          />
                          {!isEmailVerified && (
                            <button
                              type="button"
                              onClick={handleSendOnboardingOtp}
                              disabled={isSendingOtp || !onboardingEmail.trim()}
                              className="gold-glow-btn"
                              style={{ padding: '0 16px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                            >
                              {isSendingOtp ? 'Sending...' : 'Send OTP'}
                            </button>
                          )}
                        </div>
                        {isEmailVerified && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--status-green)', marginTop: '4px', display: 'block', fontWeight: 600 }}>
                            ✓ Email Verified
                          </span>
                        )}
                        {otpSentMessage && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', marginTop: '4px', display: 'block' }}>
                            {otpSentMessage}
                          </span>
                        )}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Contact Number <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="tel" 
                          placeholder="e.g. 9876543210"
                          value={onboardingContactNumber}
                          onChange={(e) => setOnboardingContactNumber(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          required
                        />
                      </div>
                    </div>

                    {showOtpInput && (
                      <div style={{ background: 'rgba(212, 175, 55, 0.05)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Enter Email Verification OTP <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            placeholder="6-digit OTP code"
                            value={onboardingOtp}
                            onChange={(e) => setOnboardingOtp(e.target.value)}
                            style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                          />
                          <button
                            type="button"
                            onClick={handleVerifyOnboardingOtp}
                            disabled={isVerifyingOtp}
                            className="gold-glow-btn"
                            style={{ padding: '0 20px', fontSize: '0.8rem' }}
                          >
                            {isVerifyingOtp ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                        {otpVerifyMessage && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--status-red)' }}>
                            {otpVerifyMessage}
                          </span>
                        )}
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Shop Location Address <span style={{ color: 'var(--status-red)' }}>*</span>
                      </label>
                      <input 
                        type="text" 
                        placeholder="e.g. Plot 42, MP Nagar Zone 2, Bhopal"
                        value={onboardingLocation}
                        onChange={(e) => setOnboardingLocation(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Google Maps URL <span style={{ color: 'var(--status-red)' }}>*</span>
                      </label>
                      <input 
                        type="url" 
                        placeholder="e.g. https://maps.google.com/?q=your+shop+location"
                        value={onboardingMapsUrl}
                        onChange={(e) => setOnboardingMapsUrl(e.target.value)}
                        style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                        required
                      />
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Open Google Maps → Search your shop → Copy the URL from your browser
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Stylist Chairs Count <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="number" 
                          min={1} 
                          max={15}
                          value={onboardingChairsCount}
                          onChange={(e) => setOnboardingChairsCount(Number(e.target.value) || 2)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Opening Hours <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="time" 
                          value={onboardingOpeningTime}
                          onChange={(e) => setOnboardingOpeningTime(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                          Closing Hours <span style={{ color: 'var(--status-red)' }}>*</span>
                        </label>
                        <input 
                          type="time" 
                          value={onboardingClosingTime}
                          onChange={(e) => setOnboardingClosingTime(e.target.value)}
                          style={{ width: '100%', padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                        />
                      </div>
                    </div>

                    {/* Weekly Operating Days Selection */}
                    <div style={{ marginTop: '16px', marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                        Weekly Operating Days <span style={{ color: 'var(--status-red)' }}>*</span>
                      </label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {[
                          { day: 'Mon', label: 'Monday' },
                          { day: 'Tue', label: 'Tuesday' },
                          { day: 'Wed', label: 'Wednesday' },
                          { day: 'Thu', label: 'Thursday' },
                          { day: 'Fri', label: 'Friday' },
                          { day: 'Sat', label: 'Saturday' },
                          { day: 'Sun', label: 'Sunday' },
                        ].map((d) => {
                          const isChecked = onboardingWorkingDays.includes(d.day);
                          return (
                            <label 
                              key={d.day} 
                              style={{ 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '6px', 
                                padding: '8px 12px', 
                                background: isChecked ? 'rgba(212, 175, 55, 0.08)' : 'var(--bg-tertiary)', 
                                border: isChecked ? '1px solid var(--accent-gold)' : '1px solid var(--border-light)', 
                                borderRadius: '8px', 
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: isChecked ? 'var(--accent-gold)' : 'var(--text-secondary)',
                                userSelect: 'none',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    if (onboardingWorkingDays.length > 1) {
                                      setOnboardingWorkingDays(onboardingWorkingDays.filter(day => day !== d.day));
                                    } else {
                                      showToast('At least one operating day must be selected.');
                                    }
                                  } else {
                                    setOnboardingWorkingDays([...onboardingWorkingDays, d.day]);
                                  }
                                }}
                                style={{ display: 'none' }}
                              />
                              {d.label}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Services Manager */}
                    <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        Services Offered & Price Menus <span style={{ color: 'var(--status-red)' }}>*</span>
                      </h4>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '16px' }}>
                        Add services that clients can book at your shop.
                      </p>

                      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <input 
                          type="text" 
                          placeholder="Service Name (e.g. Haircut)"
                          value={newServiceName}
                          onChange={(e) => setNewServiceName(e.target.value)}
                          style={{ flex: 2, minWidth: '160px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                        />
                        <input 
                          type="number" 
                          placeholder="Price in ₹ (e.g. 150)"
                          value={newServicePrice}
                          onChange={(e) => setNewServicePrice(e.target.value)}
                          style={{ flex: 1, minWidth: '100px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                        />
                        <input 
                          type="number" 
                          placeholder="Duration in mins (e.g. 20)"
                          value={newServiceDuration}
                          onChange={(e) => setNewServiceDuration(e.target.value)}
                          style={{ flex: 1, minWidth: '120px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                        />
                        <select
                          value={newServiceCategory}
                          onChange={(e) => setNewServiceCategory(e.target.value as any)}
                          style={{ flex: 1.2, minWidth: '120px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '8px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.88rem' }}
                        >
                          <option value="unisex">✨ Unisex</option>
                          <option value="men">🧔 Men Only</option>
                          <option value="women">👩 Women Only</option>
                        </select>
                        <button 
                          type="button" 
                          className="btn-secondary" 
                          style={{ padding: '10px 16px', fontSize: '0.88rem' }}
                          onClick={handleAddOnboardingService}
                        >
                          <Plus size={16} /> Add
                        </button>
                      </div>

                      {/* Services list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {onboardingServices.map((srv, idx) => (
                          <div 
                            key={idx} 
                            style={{ 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center', 
                              background: 'rgba(255, 255, 255, 0.02)', 
                              border: '1px solid var(--border-light)', 
                              borderRadius: '8px', 
                              padding: '10px 16px' 
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{srv.name}</strong>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '12px' }}>
                                {srv.durationMinutes} mins | <span style={{ color: 'var(--accent-gold)', textTransform: 'capitalize' }}>{srv.category || 'unisex'}</span>
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                              <span style={{ fontWeight: 600, color: 'var(--accent-gold)', fontSize: '0.9rem' }}>
                                ₹{srv.price}
                              </span>
                              <button 
                                type="button" 
                                style={{ background: 'transparent', border: 'none', color: 'var(--status-red)', cursor: 'pointer' }}
                                onClick={() => handleRemoveOnboardingService(idx)}
                              >
                                <Trash size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {onboardingError && (
                      <div style={{ background: 'rgba(239, 68, 68, 0.12)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{onboardingError}</span>
                      </div>
                    )}

                    {!isEmailVerified && !onboardingError && (
                      <div style={{ background: 'rgba(212, 175, 55, 0.08)', color: 'var(--accent-gold)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                        <AlertCircle size={16} style={{ flexShrink: 0 }} />
                        <span>Note: Click <strong>"Verify"</strong> next to your email above with the OTP before submitting.</span>
                      </div>
                    )}

                    <button 
                      type="submit" 
                      className="gold-glow-btn"
                      style={{ padding: '14px', justifyContent: 'center', width: '100%', marginTop: '10px' }}
                      disabled={submittingOnboarding}
                    >
                      {submittingOnboarding ? 'Submitting Application...' : 'Submit Partnership Application'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Check Status Tab */}
            {onboardingTab === 'status' && (
              <div>
                <form onSubmit={handleCheckStatus} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                  <input 
                    type="email" 
                    placeholder="Enter your application email address"
                    value={onboardingEmailInput}
                    onChange={(e) => setOnboardingEmailInput(e.target.value)}
                    style={{ flex: 1, padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '10px', color: 'var(--text-primary)', outline: 'none' }}
                    required
                  />
                  <button 
                    type="submit" 
                    className="gold-glow-btn" 
                    style={{ padding: '12px 20px' }}
                    disabled={checkingStatus}
                  >
                    {checkingStatus ? 'Checking...' : 'Check Status'}
                  </button>
                </form>

                {statusMessage && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid var(--border-light)', padding: '16px', borderRadius: '10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    {statusMessage}
                  </div>
                )}

                {checkedApplication && (
                  <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{checkedApplication.shopName}</h4>
                      
                      {checkedApplication.status === 'approved' && (
                        <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--status-green)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Approved
                        </span>
                      )}
                      {checkedApplication.status === 'pending' && (
                        <span style={{ background: 'rgba(251, 191, 36, 0.1)', color: 'var(--status-amber)', border: '1px solid rgba(251, 191, 36, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Pending Review
                        </span>
                      )}
                      {checkedApplication.status === 'rejected' && (
                        <span style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Revisions Required
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div><strong>Owner:</strong> {checkedApplication.ownerName}</div>
                      <div><strong>Phone:</strong> {checkedApplication.contactNumber}</div>
                      <div><strong>Hours:</strong> {checkedApplication.openingTime} - {checkedApplication.closingTime}</div>
                      <div><strong>Chairs:</strong> {checkedApplication.chairsCount} Stylist Seats</div>
                    </div>

                    {checkedApplication.status === 'rejected' && (
                      <div 
                        style={{ 
                          background: 'rgba(239, 68, 68, 0.05)', 
                          border: '1px solid rgba(239, 68, 68, 0.15)', 
                          borderRadius: '8px', 
                          padding: '12px', 
                          marginTop: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <strong style={{ color: 'var(--status-red)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <AlertTriangle size={14} /> ADMIN FEEDBACK COMMENTS:
                        </strong>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                          {checkedApplication.rejectionFeedback || 'Please review your shop details and resubmit.'}
                        </p>
                        
                        <button 
                          className="btn-danger" 
                          style={{ marginTop: '10px', padding: '10px', justifyContent: 'center', width: '100%', fontSize: '0.85rem' }}
                          onClick={() => handleEditAndResubmit(checkedApplication)}
                        >
                          <Edit size={14} style={{ marginRight: '6px' }} /> Edit Details & Resubmit
                        </button>
                      </div>
                    )}

                    {checkedApplication.status === 'approved' && (
                      <div 
                        style={{ 
                          background: 'rgba(56, 189, 248, 0.05)', 
                          border: '1px solid rgba(56, 189, 248, 0.15)', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          marginTop: '8px',
                          textAlign: 'center'
                        }}
                      >
                        <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Congratulations! Your shop has been approved. Your login credentials and password have been sent to your email.
                          <br />Email: <strong>{checkedApplication.email}</strong>
                        </p>
                        <button 
                          className="gold-glow-btn"
                          style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                          onClick={() => {
                            setShowOnboardingModal(false);
                            setEmail(checkedApplication.email);
                            setPassword('');
                            setIsSignup(false);
                            setShowLoginModal(true);
                          }}
                        >
                          Proceed to Log In
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}



      {/* Change Password Modal Overlay */}
      {showChangePasswordModal && (
        <div className="modal-overlay-backdrop animate-fade-in" onClick={() => setShowChangePasswordModal(false)}>
          <div 
            className="glass-card" 
            style={{ width: '100%', maxWidth: '440px', padding: '40px 32px', position: 'relative' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={() => {
                setShowChangePasswordModal(false);
                setOldPassword('');
                setNewPasswordVal('');
                setConfirmNewPassword('');
                setChangePasswordError('');
                setChangePasswordSuccess('');
              }}
              style={{ 
                position: 'absolute', 
                top: '20px', 
                right: '20px', 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--text-secondary)', 
                cursor: 'pointer' 
              }}
            >
              <X size={20} />
            </button>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', background: 'var(--accent-gold-glow)', borderRadius: '50%', color: 'var(--accent-gold)', marginBottom: '12px' }}>
                <Lock size={24} />
              </div>
              <h2 style={{ fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '-0.02em', fontWeight: 800 }}>
                Change <span>Password</span>
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>Update your account password</p>
            </div>

            {changePasswordError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', color: 'var(--status-red)', border: '1px solid rgba(239, 68, 68, 0.15)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{changePasswordError}</span>
              </div>
            )}

            {changePasswordSuccess && (
              <div style={{ background: 'rgba(34, 197, 94, 0.08)', color: 'var(--status-green)', border: '1px solid rgba(34, 197, 94, 0.15)', padding: '12px', borderRadius: '10px', marginBottom: '20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✓ {changePasswordSuccess}</span>
              </div>
            )}

            <form onSubmit={handleChangePasswordSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Old Password
                </label>
                <input 
                  type="password"
                  placeholder="Enter old password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  New Password
                </label>
                <input 
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Confirm New Password
                </label>
                <input 
                  type="password"
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', borderRadius: '12px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
                />
              </div>
              <button 
                type="submit"
                disabled={isChangingPassword}
                className="gold-glow-btn"
                style={{ justifyContent: 'center', marginTop: '10px', padding: '12px' }}
              >
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Premium Fullscreen Lightbox Slideshow Modal */}
      {isLightboxOpen && lightboxImages.length > 0 && (
        <div 
          className="animate-fade-in" 
          style={{ 
            position: 'fixed', 
            inset: 0, 
            background: 'rgba(0, 0, 0, 0.94)', 
            backdropFilter: 'blur(8px)', 
            zIndex: 9999, 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center',
            userSelect: 'none'
          }}
          onClick={() => setIsLightboxOpen(false)}
        >
          {/* Close Button */}
          <button
            onClick={() => setIsLightboxOpen(false)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '50%',
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              zIndex: 10000
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <X size={22} />
          </button>

          {/* Navigation Controls Wrapper */}
          <div 
            style={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: '900px', 
              height: '70vh', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: '0 48px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Left Chevron Button */}
            {lightboxIndex > 0 && (
              <button
                onClick={() => setLightboxIndex(prev => prev - 1)}
                style={{
                  position: 'absolute',
                  left: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-gold)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10000
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-gold-glow)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--accent-gold)';
                }}
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Image Preview Container */}
            <div 
              style={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                overflow: 'hidden'
              }}
            >
              <img 
                src={lightboxImages[lightboxIndex]} 
                alt={`Slideshow ${lightboxIndex + 1}`} 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '100%', 
                  objectFit: 'contain', 
                  borderRadius: '12px',
                  boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }} 
              />
            </div>

            {/* Right Chevron Button */}
            {lightboxIndex < lightboxImages.length - 1 && (
              <button
                onClick={() => setLightboxIndex(prev => prev + 1)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '50%',
                  width: '48px',
                  height: '48px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-gold)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  zIndex: 10000
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--accent-gold-glow)';
                  e.currentTarget.style.color = '#fff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  e.currentTarget.style.color = 'var(--accent-gold)';
                }}
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Indicator text at bottom */}
          <div 
            style={{ 
              marginTop: '20px', 
              color: 'rgba(255, 255, 255, 0.6)', 
              fontSize: '0.9rem', 
              fontWeight: 500,
              background: 'rgba(255, 255, 255, 0.05)',
              padding: '6px 16px',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              letterSpacing: '0.05em'
            }}
          >
            {lightboxIndex + 1} / {lightboxImages.length}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMsg && (
        <div className="toast-container animate-fade-in">
          <div className="toast-card">
            {toastMsg.toLowerCase().includes('cancel') ? (
              <AlertCircle size={18} style={{ color: 'var(--status-red)' }} />
            ) : (
              <CheckCircle size={18} style={{ color: 'var(--accent-gold)' }} />
            )}
            <span>{toastMsg}</span>
          </div>
        </div>
      )}

    </div>
  );
}
