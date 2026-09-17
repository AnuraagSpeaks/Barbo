import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db/db.js';
import http from 'http';
import https from 'https';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// === File Upload Setup (multer) ===
// For Railway persistent storage, try using '/data/uploads' first
let uploadsDir = '/data/uploads';
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  // Fallback to local server directory if /data/uploads is not writeable (e.g. local environment)
  uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `img-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});


// Nodemailer SMTP Transporter Setup
let transporter;
try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    },
    connectionTimeout: 8000, // 8 seconds
    greetingTimeout: 8000,
    socketTimeout: 10000
  });
} catch (err) {
  console.warn("⚠️ Failed to initialize SMTP transporter:", err.message);
}

// Mail Dispatcher Helper (Console Logging + JSON Local Log File + Real SMTP fallback)
const sendMail = async ({ to, subject, text, html }) => {
  const timestamp = new Date().toISOString();
  const emailLog = { timestamp, to, subject, text, html };
  
  // 1. Visually stunning console logging
  console.log(`\n==================================================`);
  console.log(`📧 DISPATCHING EMAIL (${timestamp})`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Body: ${text}`);
  console.log(`==================================================\n`);

  // 2. Append email details to a local mock mailbox file for local testing retrieval
  const logDir = path.join(__dirname, 'db');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'sent_emails.json');
  let logs = [];
  try {
    if (fs.existsSync(logFile)) {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
  } catch (e) {
    // File empty or malformed
  }
  logs.push(emailLog);
  try {
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing mock sent_emails.json log:", e.message);
  }

  // 3. Send real email via Brevo HTTP API (Primary) or SMTP Relay (Fallback)
  if (process.env.BREVO_API_KEY) {
    try {
      console.log(`📡 Sending email via Brevo HTTP API to ${to}...`);
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': process.env.BREVO_API_KEY,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: {
            name: "Barbo Support",
            email: process.env.SMTP_FROM || process.env.SMTP_USER || "connect.anuragmishra@gmail.com"
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html || text,
          textContent: text
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Brevo HTTP email delivered successfully to ${to}. Message ID:`, result.messageId);
        return { success: true };
      } else {
        const errText = await response.text();
        console.error(`❌ Brevo HTTP API failed for ${to} (${response.status}): ${errText}`);
        return { success: false, error: `Brevo error (${response.status}): ${errText}` };
      }
    } catch (apiErr) {
      console.error(`❌ Brevo HTTP API error for ${to}: ${apiErr.message}`);
      return { success: false, error: apiErr.message };
    }
  } else if (transporter && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      console.log(`📡 Sending email via SMTP Relay to ${to}...`);
      await transporter.sendMail({
        from: `"Barbo Support" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html
      });
      console.log(`✅ SMTP email delivered successfully to ${to}`);
      return { success: true };
    } catch (smtpErr) {
      console.error(`❌ SMTP relay delivery failed for ${to}:`, smtpErr.message);
      return { success: false, error: `SMTP error: ${smtpErr.message}` };
    }
  }

  return { success: true, mock: true };
};

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const formatDateLocal = (dateVal) => {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ==========================================
// GEOLOCATION MATH UTILS
// ==========================================
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // returns meters
};

const expandUrl = (shortUrl) => {
  return new Promise((resolve) => {
    if (!shortUrl || (!shortUrl.includes('maps.app.goo.gl') && !shortUrl.includes('goo.gl/maps'))) {
      resolve(shortUrl);
      return;
    }

    const client = shortUrl.startsWith('https') ? https : http;
    const requestWithTimeout = (url, depth = 0) => {
      if (depth > 5) {
        resolve(url);
        return;
      }

      try {
        const req = client.request(url, { method: 'HEAD' }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            let nextUrl = res.headers.location;
            if (!nextUrl.startsWith('http')) {
              nextUrl = new URL(nextUrl, url).href;
            }
            requestWithTimeout(nextUrl, depth + 1);
          } else {
            resolve(url);
          }
        });
        
        req.on('error', (err) => {
          console.error("Error expanding short URL via HEAD, trying GET:", err);
          client.get(url, (getRes) => {
            if (getRes.statusCode >= 300 && getRes.statusCode < 400 && getRes.headers.location) {
              let nextUrl = getRes.headers.location;
              if (!nextUrl.startsWith('http')) {
                nextUrl = new URL(nextUrl, url).href;
              }
              requestWithTimeout(nextUrl, depth + 1);
            } else {
              resolve(url);
            }
          }).on('error', (getErr) => {
            console.error("GET expansion error:", getErr);
            resolve(url);
          });
        });

        req.setTimeout(3000, () => {
          req.destroy();
          resolve(url);
        });

        req.end();
      } catch (e) {
        console.error("Exception in expandUrl:", e);
        resolve(url);
      }
    };

    requestWithTimeout(shortUrl);
  });
};

const extractCoords = (url) => {
  let lat = null;
  let lon = null;
  
  // Try matching various formats
  // 1. !3dLat!4dLon (exact place coordinate in Google Maps URL data parameter)
  const placeMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (placeMatch) {
    lat = parseFloat(placeMatch[1]);
    lon = parseFloat(placeMatch[2]);
    return { lat, lon };
  }

  // 2. @Lat,Lon (viewport or place coordinate)
  // 3. q=Lat,Lon or query=Lat,Lon or ll=Lat,Lon
  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                     url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                     url.match(/query=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                     url.match(/ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    lat = parseFloat(coordMatch[1]);
    lon = parseFloat(coordMatch[2]);
  }
  return { lat, lon };
};


const resolveMapsUrlAndCoords = async (mapsUrl, currentLat, currentLon) => {
  let resolvedUrl = mapsUrl ? mapsUrl.trim() : '';
  let resolvedLat = currentLat;
  let resolvedLon = currentLon;

  if (resolvedUrl && (resolvedUrl.includes('maps.app.goo.gl') || resolvedUrl.includes('goo.gl/maps'))) {
    const expanded = await expandUrl(resolvedUrl);
    if (expanded && expanded !== resolvedUrl) {
      resolvedUrl = expanded;
      const coords = extractCoords(expanded);
      if (coords.lat !== null && coords.lon !== null) {
        resolvedLat = coords.lat;
        resolvedLon = coords.lon;
      }
    }
  }

  if (resolvedLat === undefined || resolvedLat === null || isNaN(resolvedLat) || resolvedLat === 23.2500) {
    const coords = extractCoords(resolvedUrl);
    if (coords.lat !== null && coords.lon !== null) {
      resolvedLat = coords.lat;
      resolvedLon = coords.lon;
    }
  }

  return {
    mapsUrl: resolvedUrl,
    lat: resolvedLat || 23.2500,
    lon: resolvedLon || 77.4100
  };
};

// ==========================================
// EMAIL OTP & SECURITY REST ENDPOINTS
// ==========================================

// A. Send Onboarding Verification OTP
app.post('/api/onboarding/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    // 1. Check if email is already in use by an approved user or approved application
    const [userRows] = await pool.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    const [appRows] = await pool.query('SELECT id FROM barber_applications WHERE email = ? AND status = "approved"', [trimmedEmail]);
    
    if (userRows.length > 0 || appRows.length > 0) {
      return res.status(400).json({ success: false, message: 'An approved salon account with this email already exists.' });
    }

    // 2. Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // 3. Save/Update OTP record
    await pool.query(
      `INSERT INTO email_verifications (email, otp, verified, expires_at) 
       VALUES (?, ?, 0, ?) 
       ON DUPLICATE KEY UPDATE otp = VALUES(otp), verified = 0, expires_at = VALUES(expires_at)`,
      [trimmedEmail, otp, expiresAt]
    );

    // 4. Send email
    const mailResult = await sendMail({
      to: trimmedEmail,
      subject: 'Barbo Onboarding - Verify Your Email',
      text: `Your email verification OTP is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #d4a359; text-transform: uppercase; margin-bottom: 20px; font-weight: 800;">BARBO PARTNER ONBOARDING</h2>
          <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Thank you for initiating your onboarding application with Barbo. To verify your email address, please use the following One-Time Password (OTP):</p>
          <div style="background-color: #1e293b; padding: 15px 30px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px solid #334155;">
            <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 0.15em; color: #d4a359;">${otp}</span>
          </div>
          <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5;">This verification code is confidential and will expire in 5 minutes. If you did not request this OTP, please ignore this email.</p>
        </div>
      `
    });

    if (mailResult && !mailResult.success) {
      return res.status(500).json({ success: false, message: `Email delivery failed: ${mailResult.error}` });
    }

    res.json({ success: true, message: 'Verification OTP sent successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// B. Verify Onboarding OTP
app.post('/api/onboarding/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP are required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT otp, expires_at FROM email_verifications WHERE email = ?',
      [trimmedEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No verification request found for this email.' });
    }

    const record = rows[0];
    const expiresAt = new Date(record.expires_at);

    if (expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please enter the correct code.' });
    }

    // Mark as verified
    await pool.query(
      'UPDATE email_verifications SET verified = 1 WHERE email = ?',
      [trimmedEmail]
    );

    res.json({ success: true, message: 'Email verified successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// C. Send Password Reset OTP (Forgot Password)
app.post('/api/auth/forgot-password/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Check if user account exists
    const [userRows] = await pool.query('SELECT name FROM users WHERE email = ?', [trimmedEmail]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'No registered user found with this email address.' });
    }

    const userName = userRows[0].name;

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save/Update in email_verifications
    await pool.query(
      `INSERT INTO email_verifications (email, otp, verified, expires_at) 
       VALUES (?, ?, 0, ?) 
       ON DUPLICATE KEY UPDATE otp = VALUES(otp), verified = 0, expires_at = VALUES(expires_at)`,
      [trimmedEmail, otp, expiresAt]
    );

    // Send OTP email
    const mailResult = await sendMail({
      to: trimmedEmail,
      subject: 'Barbo - Reset Password OTP',
      text: `Hello ${userName}, your password reset OTP is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #d4a359; text-transform: uppercase; margin-bottom: 20px; font-weight: 800;">BARBO PASSWORD RESET</h2>
          <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Hello ${userName},</p>
          <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">We received a request to reset the password for your Barbo user account. Please use the following One-Time Password (OTP) to complete the reset process:</p>
          <div style="background-color: #1e293b; padding: 15px 30px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px solid #334155;">
            <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 0.15em; color: #d4a359;">${otp}</span>
          </div>
          <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5;">This code is valid for 5 minutes. If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      `
    });

    if (mailResult && !mailResult.success) {
      return res.status(500).json({ success: false, message: `Email delivery failed: ${mailResult.error}` });
    }

    res.json({ success: true, message: 'Password reset OTP sent to your email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// D. Reset Password With OTP
app.post('/api/auth/forgot-password/reset', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query(
      'SELECT otp, expires_at FROM email_verifications WHERE email = ?',
      [trimmedEmail]
    );

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: 'No verification record found for this email.' });
    }

    const record = rows[0];
    const expiresAt = new Date(record.expires_at);

    if (expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP.' });
    }

    // Reset password in users table
    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [newPassword, trimmedEmail]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Clean up verification record
    await pool.query('DELETE FROM email_verifications WHERE email = ?', [trimmedEmail]);

    res.json({ success: true, message: 'Password has been reset successfully! Please log in.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// E. Change Password (For Logged In Users)
app.post('/api/auth/change-password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  if (!email || !oldPassword || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, old password, and new password are required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query('SELECT password FROM users WHERE email = ?', [trimmedEmail]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    const currentPassword = rows[0].password;
    if (currentPassword !== oldPassword) {
      return res.status(400).json({ success: false, message: 'Incorrect old password.' });
    }

    // Update password
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [newPassword, trimmedEmail]);

    res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1. Auth Login Route
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
    
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Use aayu@barbo.in or rajesh@barbo.in' });
    }

    const user = rows[0];
    if (user.password !== password) {
      return res.status(401).json({ success: false, message: 'Incorrect password. Hint: 123456' });
    }

    // Expose clean credentials structure
    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        barberId: user.barber_id
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.45. Auth Signup Send OTP Route
app.post('/api/auth/signup/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Check if email already in use
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Save/Update in email_verifications
    await pool.query(
      `INSERT INTO email_verifications (email, otp, verified, expires_at) 
       VALUES (?, ?, 0, ?) 
       ON DUPLICATE KEY UPDATE otp = VALUES(otp), verified = 0, expires_at = VALUES(expires_at)`,
      [trimmedEmail, otp, expiresAt]
    );

    // Send OTP email
    const mailResult = await sendMail({
      to: trimmedEmail,
      subject: 'Barbo - Verify Your Email to Sign Up',
      text: `Your email verification OTP is: ${otp}. It will expire in 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
          <h2 style="color: #d4a359; text-transform: uppercase; margin-bottom: 20px; font-weight: 800;">VERIFY YOUR EMAIL</h2>
          <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Thank you for starting your registration with Barbo. To complete your account sign up, please use the following One-Time Password (OTP):</p>
          <div style="background-color: #1e293b; padding: 15px 30px; border-radius: 8px; text-align: center; margin: 30px 0; border: 1px solid #334155;">
            <span style="font-size: 2.2rem; font-weight: 800; letter-spacing: 0.15em; color: #d4a359;">${otp}</span>
          </div>
          <p style="font-size: 0.85rem; color: #64748b; line-height: 1.5;">This verification code is valid for 5 minutes. If you did not request this code, you can safely ignore this email.</p>
        </div>
      `
    });

    if (mailResult && !mailResult.success) {
      return res.status(500).json({ success: false, message: `Email delivery failed: ${mailResult.error}` });
    }

    res.json({ success: true, message: 'Verification OTP sent to your email.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 1.5. Auth Signup Route
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, otp } = req.body;
  if (!name || !email || !password || !otp) {
    return res.status(400).json({ success: false, message: 'Name, email, password and OTP are required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    
    // Check OTP first
    const [verifications] = await pool.query(
      'SELECT otp, expires_at FROM email_verifications WHERE email = ?',
      [trimmedEmail]
    );

    if (verifications.length === 0) {
      return res.status(400).json({ success: false, message: 'No verification record found for this email. Please request an OTP first.' });
    }

    const verification = verifications[0];
    const expiresAt = new Date(verification.expires_at);

    if (expiresAt < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification OTP has expired. Please request a new one.' });
    }

    if (verification.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please enter the correct code.' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email is already registered' });
    }

    const userId = `cust-${Date.now()}`;
    await pool.query(
      'INSERT INTO users (id, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, trimmedEmail, password, name.trim(), 'customer']
    );

    // Clean up OTP record
    await pool.query('DELETE FROM email_verifications WHERE email = ?', [trimmedEmail]);

    res.status(201).json({
      success: true,
      message: 'Registration successful!',
      user: {
        id: userId,
        email: trimmedEmail,
        name: name.trim(),
        role: 'customer',
        barberId: null
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Serve uploaded images as static files
app.use('/uploads', express.static(uploadsDir));

// Image Upload Endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file provided' });
  }
  const serverBase = process.env.SERVER_URL || `http://localhost:${PORT}`;
  const imageUrl = `${serverBase}/uploads/${req.file.filename}`;
  res.json({ success: true, url: imageUrl });
});


app.get('/api/services', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, description, price, duration_minutes as durationMinutes, barber_id as barberId, category FROM services');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// 3. Barbers List & Proximity Finder
app.get('/api/barbers', async (req, res) => {
  const { lat, lng } = req.query;

  try {
    const [barbersRows] = await pool.query('SELECT * FROM barbers');
    
    const formattedBarbers = await Promise.all(
      barbersRows.map(async (barber) => {
        // Fetch portfolio
        const [portfolio] = await pool.query('SELECT image_url FROM barber_portfolio WHERE barber_id = ? ORDER BY display_order ASC, id ASC', [barber.id]);
        
        // Calculate distance dynamically if client coordinates are passed
        let dist = barber.distance_meters;
        let route = [
          { lat: Number(barber.lat), lng: Number(barber.lon) }
        ];

        if (lat && lng) {
          dist = calculateDistance(Number(lat), Number(lng), Number(barber.lat), Number(barber.lon));
          route = [
            { lat: Number(lat), lng: Number(lng) },
            { lat: Number(lat) + (Number(barber.lat) - Number(lat)) * 0.5, lng: Number(lng) },
            { lat: Number(barber.lat), lng: Number(lng) + (Number(barber.lon) - Number(lng)) * 0.5 },
            { lat: Number(barber.lat), lng: Number(barber.lon) }
          ];
        }

        return {
          id: barber.id,
          name: barber.name,
          title: barber.title,
          specialty: barber.specialty,
          rating: Number(barber.rating),
          reviewsCount: barber.reviews_count,
          imageUrl: barber.image_url,
          delayStatus: barber.delay_status,
          portfolioImages: portfolio.map(p => p.image_url),
          location: barber.location,
          mapsUrl: barber.maps_url,
          distanceMeters: dist,
          routeCoordinates: route,
          leadStylist: barber.lead_stylist,
          lat: Number(barber.lat),
          lon: Number(barber.lon),
          chairsCount: barber.chairs_count,
          openingTime: barber.opening_time || '09:00',
          closingTime: barber.closing_time || '21:00',
          workingDays: barber.working_days || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'
        };
      })
    );

    // Sort by calculated proximity
    formattedBarbers.sort((a, b) => a.distanceMeters - b.distanceMeters);
    res.json(formattedBarbers);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Overpass API Real-world Salons Upserter/Sync
app.post('/api/barbers/sync', async (req, res) => {
  const { barbers } = req.body;
  if (!Array.isArray(barbers) || barbers.length === 0) {
    return res.status(400).json({ success: false, message: 'Barbers list is required' });
  }

  try {
    for (const barber of barbers) {
      await pool.query(
        `INSERT INTO barbers (id, name, title, specialty, rating, reviews_count, image_url, location, maps_url, distance_meters, lead_stylist, lat, lon, chairs_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           name=VALUES(name), title=VALUES(title), specialty=VALUES(specialty), 
           rating=VALUES(rating), reviews_count=VALUES(reviews_count), 
           image_url=VALUES(image_url), location=VALUES(location), 
           distance_meters=VALUES(distance_meters), lat=VALUES(lat), lon=VALUES(lon),
           chairs_count=VALUES(chairs_count)`,
        [
          barber.id, barber.name, barber.title, barber.specialty, 
          barber.rating, barber.reviewsCount, barber.imageUrl, 
          barber.location, barber.mapsUrl, barber.distanceMeters, 
          barber.leadStylist, barber.lat, barber.lon, barber.chairsCount || 2
        ]
      );

      // Refresh portfolio images
      await pool.query('DELETE FROM barber_portfolio WHERE barber_id = ?', [barber.id]);
      if (Array.isArray(barber.portfolioImages)) {
        for (const url of barber.portfolioImages) {
          await pool.query('INSERT INTO barber_portfolio (barber_id, image_url) VALUES (?, ?)', [barber.id, url]);
        }
      }
    }
    res.json({ success: true, message: 'Sync complete' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Appointments Retriever Route
app.get('/api/appointments', async (req, res) => {
  const { userId, role } = req.query;
  if (!userId || !role) {
    return res.status(400).json({ success: false, message: 'userId and role are required' });
  }

  try {
    let query = '';
    let queryParam = userId;

    if (role === 'customer') {
      query = 'SELECT * FROM appointments WHERE customer_id = ? ORDER BY date DESC, start_time DESC';
    } else {
      const [userRows] = await pool.query('SELECT barber_id FROM users WHERE id = ?', [userId]);
      if (userRows.length > 0 && userRows[0].barber_id) {
        queryParam = userRows[0].barber_id;
      }
      query = 'SELECT * FROM appointments WHERE barber_id = ? ORDER BY date DESC, start_time DESC';
    }

    const [appointments] = await pool.query(query, [queryParam]);
    
    const detailedAppointments = await Promise.all(
      appointments.map(async (app) => {
        // Fetch service objects
        const [servicesRows] = await pool.query(
          `SELECT s.* FROM services s 
           INNER JOIN appointment_services aserv ON s.id = aserv.service_id 
           WHERE aserv.appointment_id = ?`,
          [app.id]
        );

        // Fetch notifications list
        const [notifsRows] = await pool.query(
          'SELECT message FROM appointment_notifications WHERE appointment_id = ? ORDER BY created_at ASC',
          [app.id]
        );

        // Check if appointment is reviewed
        const [reviewRows] = await pool.query(
          'SELECT id FROM reviews WHERE appointment_id = ?',
          [app.id]
        );
        const reviewed = reviewRows.length > 0;

        // Fetch LIVE barber location (maps_url, lat, lon) so navigation always uses the latest approved URL
        let barberMapsUrl = '';
        let barberLocation = '';
        try {
          const [liveBarber] = await pool.query(
            'SELECT maps_url, lat, lon, location FROM barbers WHERE id = ?',
            [app.barber_id]
          );
          if (liveBarber.length > 0) {
            barberMapsUrl = liveBarber[0].maps_url || '';
            barberLocation = liveBarber[0].location || '';
          }
        } catch (e) {}

        // Clean time format (HH:MM)
        const formatTime = (timeStr) => timeStr ? timeStr.substring(0, 5) : '';

        return {
          id: app.id,
          customerId: app.customer_id,
          customerName: app.customer_name,
          barberId: app.barber_id,
          barberName: app.barber_name,
          barberMapsUrl,
          location: barberLocation,
          date: formatDateLocal(app.date),
          startTime: formatTime(app.start_time),
          endTime: formatTime(app.end_time),
          services: servicesRows,
          totalPrice: app.total_price,
          totalDuration: app.total_duration,
          status: app.status,
          paymentMethod: app.payment_method,
          paymentStatus: app.payment_status,
          travelOtp: app.travel_otp,
          userLat: Number(app.user_lat),
          userLon: Number(app.user_lon),
          barberLat: Number(app.barber_lat),
          barberLon: Number(app.barber_lon),
          travelLat: Number(app.travel_lat),
          travelLon: Number(app.travel_lon),
          travelEta: app.travel_eta,
          travelDistance: app.travel_distance,
          travelStatus: app.travel_status,
          travelSimProgress: app.travel_sim_progress,
          travelRouteCoordinates: app.travel_route_coordinates ? JSON.parse(app.travel_route_coordinates) : null,
          notifications: notifsRows.map(n => n.message),
          reviewed: reviewed
        };
      })
    );


    res.json(detailedAppointments);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. Book Appointment Route
app.post('/api/appointments', async (req, res) => {
  const { customerId, customerName, barberId, date, startTime, serviceIds, paymentMethod, paymentStatus } = req.body;
  if (!customerId || !barberId || !date || !startTime || !Array.isArray(serviceIds)) {
    return res.status(400).json({ success: false, message: 'Invalid booking payload' });
  }

  try {
    // Validate that the slot is at least 30 minutes in the future
    const [yVal, mVal, dVal] = date.split('-').map(Number);
    const [hVal, minVal] = startTime.split(':').map(Number);
    const bookedTime = new Date(yVal, mVal - 1, dVal, hVal, minVal, 0);
    const now = new Date();
    if (bookedTime.getTime() - now.getTime() < 30 * 60 * 1000) {
      return res.status(400).json({
        success: false,
        message: 'New bookings must be scheduled at least 30 minutes in advance.'
      });
    }

    // 1. Fetch services to sum prices/durations
    const [servicesRows] = await pool.query('SELECT * FROM services WHERE id IN (?)', [serviceIds]);
    if (servicesRows.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid services selected' });
    }

    const totalPrice = servicesRows.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = servicesRows.reduce((sum, s) => sum + s.duration_minutes, 0);

    // Calculate end time
    const [startHour, startMin] = startTime.split(':').map(Number);
    let endHour = startHour;
    let endMin = startMin + totalDuration;
    if (endMin >= 60) {
      endHour += Math.floor(endMin / 60);
      endMin = endMin % 60;
    }
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    // 2. Fetch barber coordinates
    const [barberRows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [barberId]);
        if (barberRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Barber not found' });
    }
    const barber = barberRows[0];

    // 3. Capacity scheduling checking (multi-chair capacity)
    const startNum = startHour * 60 + startMin;
    const endNum = endHour * 60 + endMin;
    const capacity = barber.chairs_count || 2;

    const [existingApps] = await pool.query(
      "SELECT start_time, end_time FROM appointments WHERE barber_id = ? AND date = ? AND status IN ('upcoming', 'in_progress')",
      [barberId, date]
    );

    let hasConflict = false;
    for (let t = startNum; t < endNum; t++) {
      let activeCount = 0;
      for (const app of existingApps) {
        const [appSH, appSM] = app.start_time.split(':').map(Number);
        const [appEH, appEM] = app.end_time.split(':').map(Number);
        const appStart = appSH * 60 + appSM;
        const appEnd = appEH * 60 + appEM;

        if (t >= appStart && t < appEnd) {
          activeCount++;
        }
      }
      if (activeCount >= capacity) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      return res.status(409).json({ success: false, message: 'Time slot collision detected! The salon is at full capacity.' });
    }

    // 4. Generate travel OTP securely
    const randomOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // 5. Setup default Bhopal coords if customer GPS is omitted
    const defaultUserLat = 23.2495;
    const defaultUserLon = 77.4172;
    const initialRoute = [
      { lat: defaultUserLat, lng: defaultUserLon },
      { lat: Number(barber.lat), lng: Number(barber.lon) }
    ];

    const appointmentId = `a-${Date.now()}`;

    // 6. Insert new appointment
    await pool.query(
      `INSERT INTO appointments (
        id, customer_id, customer_name, barber_id, barber_name, date, start_time, end_time, 
        total_price, total_duration, status, payment_method, payment_status, travel_otp, user_lat, user_lon, 
        barber_lat, barber_lon, travel_lat, travel_lon, travel_eta, travel_distance, 
        travel_status, travel_sim_progress, travel_route_coordinates
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upcoming', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Preparing Departure...', 0, ?)`,
      [
        appointmentId, customerId, customerName, barberId, barber.name, date, startTime, endTime,
        totalPrice, totalDuration, paymentMethod || 'Pay At Shop', paymentStatus || 'unpaid', randomOtp, defaultUserLat, defaultUserLon,
        barber.lat, barber.lon, defaultUserLat, defaultUserLon, 
        Math.max(2, Math.round(barber.distance_meters / 150)), barber.distance_meters,
        JSON.stringify(initialRoute)
      ]
    );

    // 7. Insert mapping rows into appointment_services
    for (const serviceId of serviceIds) {
      await pool.query('INSERT INTO appointment_services (appointment_id, service_id) VALUES (?, ?)', [appointmentId, serviceId]);
    }

    res.json({
      success: true,
      appointment: {
        id: appointmentId,
        customerId,
        customerName,
        barberId,
        barberName: barber.name,
        date,
        startTime,
        endTime,
        services: servicesRows,
        totalPrice,
        totalDuration,
        status: 'upcoming',
        paymentMethod: paymentMethod || 'Pay At Shop',
        paymentStatus: paymentStatus || 'unpaid',
        travelOtp: randomOtp,
        userLat: defaultUserLat,
        userLon: defaultUserLon,
        barberLat: Number(barber.lat),
        barberLon: Number(barber.lon),
        travelLat: defaultUserLat,
        travelLon: defaultUserLon,
        travelEta: Math.max(2, Math.round(barber.distance_meters / 150)),
        travelDistance: barber.distance_meters,
        travelStatus: 'Preparing Departure...',
        travelSimProgress: 0,
        travelRouteCoordinates: initialRoute,
        notifications: []
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6b. Reschedule Appointment Route (Allowed up to 1 hour before scheduled start time)
app.post('/api/appointments/:id/reschedule', async (req, res) => {
  const { id } = req.params;
  const { date, startTime, serviceIds } = req.body;

  if (!date || !startTime) {
    return res.status(400).json({ success: false, message: 'date and startTime are required' });
  }

  try {
    // 1. Fetch appointment
    const [appRows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
    if (appRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }
    const appointment = appRows[0];

    if (appointment.status !== 'upcoming') {
      return res.status(400).json({ success: false, message: `Cannot reschedule. Appointment is already ${appointment.status}.` });
    }

    // 2. Validate new scheduled time is not in the past
    const [newY, newM, newD] = date.split('-').map(Number);
    const [newH, newMin] = startTime.split(':').map(Number);
    const newScheduledTime = new Date(newY, newM - 1, newD, newH, newMin, 0);
    const now = new Date();
    if (newScheduledTime.getTime() <= now.getTime()) {
      return res.status(400).json({ success: false, message: 'Cannot reschedule to a past date or time.' });
    }

    // 3. Validate reschedule window (30 mins if date/time changed, 5 mins if only services changed)
    const isDateTimeChanged = formatDateLocal(appointment.date) !== date || appointment.start_time.substring(0, 5) !== startTime;
    const cutoffMinutes = isDateTimeChanged ? 30 : 5;

    const [yVal, mVal, dVal] = formatDateLocal(appointment.date).split('-').map(Number);
    const [hours, minutes] = appointment.start_time.split(':').map(Number);
    const scheduledTime = new Date(yVal, mVal - 1, dVal, hours, minutes, 0);
    const timeDiffMinutes = (scheduledTime - now) / (60 * 1000);

    if (timeDiffMinutes < cutoffMinutes) {
      return res.status(400).json({
        success: false,
        message: `Rescheduling is only allowed at least ${cutoffMinutes} minutes before the scheduled start time.`
      });
    }

    // 4. Determine final service IDs (from body or fall back to existing)
    let finalServiceIds = serviceIds;
    if (!Array.isArray(finalServiceIds) || finalServiceIds.length === 0) {
      const [existingAserv] = await pool.query(
        'SELECT service_id FROM appointment_services WHERE appointment_id = ?',
        [id]
      );
      finalServiceIds = existingAserv.map(r => r.service_id);
    }

    if (finalServiceIds.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one service must be selected.' });
    }

    // Fetch services details
    const [servicesRows] = await pool.query('SELECT * FROM services WHERE id IN (?)', [finalServiceIds]);
    if (servicesRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid services selected.' });
    }

    const totalPrice = servicesRows.reduce((sum, s) => sum + s.price, 0);
    const totalDuration = servicesRows.reduce((sum, s) => sum + s.duration_minutes, 0);

    // Calculate end time
    const [startHour, startMin] = startTime.split(':').map(Number);
    let endHour = startHour;
    let endMin = startMin + totalDuration;
    if (endMin >= 60) {
      endHour += Math.floor(endMin / 60);
      endMin = endMin % 60;
    }
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    // 5. Fetch barber coordinates & capacity
    const [barberRows] = await pool.query('SELECT * FROM barbers WHERE id = ?', [appointment.barber_id]);
    const barber = barberRows[0];

    // 6. Capacity checking (overlapping slot availability)
    const startNum = startHour * 60 + startMin;
    const endNum = endHour * 60 + endMin;
    const capacity = barber.chairs_count || 2;

    const [existingApps] = await pool.query(
      "SELECT start_time, end_time FROM appointments WHERE barber_id = ? AND date = ? AND status IN ('upcoming', 'in_progress') AND id != ?",
      [appointment.barber_id, date, id]
    );

    let hasConflict = false;
    for (let t = startNum; t < endNum; t++) {
      let activeCount = 0;
      for (const app of existingApps) {
        const [appSH, appSM] = app.start_time.split(':').map(Number);
        const [appEH, appEM] = app.end_time.split(':').map(Number);
        const appStart = appSH * 60 + appSM;
        const appEnd = appEH * 60 + appEM;

        if (t >= appStart && t < appEnd) {
          activeCount++;
        }
      }
      if (activeCount >= capacity) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      return res.status(409).json({ success: false, message: 'Time slot collision detected! The salon is at full capacity at the selected time.' });
    }

    // 7. Update appointment in DB
    await pool.query(
      `UPDATE appointments 
       SET date = ?, start_time = ?, end_time = ?, total_price = ?, total_duration = ?, travel_sim_progress = 0, travel_status = 'Preparing Departure...'
       WHERE id = ?`,
      [date, startTime, endTime, totalPrice, totalDuration, id]
    );

    // Update appointment services mapping
    await pool.query('DELETE FROM appointment_services WHERE appointment_id = ?', [id]);
    for (const serviceId of finalServiceIds) {
      await pool.query('INSERT INTO appointment_services (appointment_id, service_id) VALUES (?, ?)', [id, serviceId]);
    }

    // Refresh notifications list: add rescheduling notification
    await pool.query('DELETE FROM appointment_notifications WHERE appointment_id = ?', [id]);
    await pool.query(
      "INSERT INTO appointment_notifications (appointment_id, message) VALUES (?, ?)",
      [id, `Rescheduled to ${date} at ${startTime}`]
    );

    // Fetch updated appointment
    const [updatedRows] = await pool.query('SELECT * FROM appointments WHERE id = ?', [id]);
    const app = updatedRows[0];

    const cleanTime = (t) => t.substring(0, 5);

    res.json({
      success: true,
      message: 'Appointment successfully rescheduled!',
      appointment: {
        id: app.id,
        customerId: app.customer_id,
        customerName: app.customer_name,
        barberId: app.barber_id,
        barberName: app.barber_name,
        date: formatDateLocal(app.date),
        startTime: cleanTime(app.start_time),
        endTime: cleanTime(app.end_time),
        services: servicesRows,
        totalPrice: app.total_price,
        totalDuration: app.total_duration,
        status: app.status,
        paymentMethod: app.payment_method,
        paymentStatus: app.payment_status,
        travelOtp: app.travel_otp,
        userLat: Number(app.user_lat),
        userLon: Number(app.user_lon),
        barberLat: Number(app.barber_lat),
        barberLon: Number(app.barber_lon),
        travelLat: Number(app.travel_lat),
        travelLon: Number(app.travel_lon),
        travelEta: app.travel_eta,
        travelDistance: app.travel_distance,
        travelStatus: app.travel_status,
        travelSimProgress: app.travel_sim_progress,
        travelRouteCoordinates: app.travel_route_coordinates ? JSON.parse(app.travel_route_coordinates) : null,
        notifications: [`Rescheduled to ${date} at ${startTime}`]
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 7. Patch Telemetry Simulator Route
app.patch('/api/appointments/:id/telemetry', async (req, res) => {
  const { id } = req.params;
  const { 
    travelLat, 
    travelLon, 
    travelEta, 
    travelDistance, 
    travelStatus, 
    travelSimProgress, 
    travelRouteCoordinates,
    notification,
    status
  } = req.body;

  try {
    const updates = [];
    const params = [];

    if (travelLat !== undefined) { updates.push('travel_lat = ?'); params.push(travelLat); }
    if (travelLon !== undefined) { updates.push('travel_lon = ?'); params.push(travelLon); }
    if (travelEta !== undefined) { updates.push('travel_eta = ?'); params.push(travelEta); }
    if (travelDistance !== undefined) { updates.push('travel_distance = ?'); params.push(travelDistance); }
    if (travelStatus !== undefined) { updates.push('travel_status = ?'); params.push(travelStatus); }
    if (travelSimProgress !== undefined) { updates.push('travel_sim_progress = ?'); params.push(travelSimProgress); }
    if (travelRouteCoordinates !== undefined) { updates.push('travel_route_coordinates = ?'); params.push(JSON.stringify(travelRouteCoordinates)); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (status === 'cancelled') {
      const [appRows] = await pool.query('SELECT total_price, payment_status FROM appointments WHERE id = ?', [id]);
      if (appRows.length > 0 && appRows[0].payment_status === 'paid') {
        updates.push('payment_status = ?');
        params.push('refunded');
        await pool.query('INSERT INTO appointment_notifications (appointment_id, message) VALUES (?, ?)', [id, `Refund of ₹${appRows[0].total_price} initiated to your original payment method.`]);
      }
    }

    if (updates.length > 0) {
      params.push(id);
      await pool.query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    // Insert alert into notifications stream if sent
    if (notification) {
      await pool.query('INSERT INTO appointment_notifications (appointment_id, message) VALUES (?, ?)', [id, notification]);
    }

    res.json({ success: true, message: 'Telemetry successfully updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8. Secure OTP Start Handshake Route (Verify OTP and start service)
app.post('/api/appointments/:id/start', async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body;

  if (!otp) {
    return res.status(400).json({ success: false, message: 'OTP is required' });
  }

  try {
    const [rows] = await pool.query('SELECT date, start_time, travel_otp, status FROM appointments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const appointment = rows[0];
    if (appointment.status !== 'upcoming') {
      return res.status(400).json({ success: false, message: `Cannot start service. Appointment is already ${appointment.status}.` });
    }
    
    if (appointment.travel_otp !== otp) {
      return res.status(400).json({ success: false, message: 'OTP verification failed! Invalid check-in code.' });
    }

    // Check if slot has fully passed
    const [yVal, mVal, dVal] = appointment.date.split('-').map(Number);
    const [endHours, endMinutes] = appointment.end_time.split(':').map(Number);
    const slotEndTime = new Date(yVal, mVal - 1, dVal, endHours, endMinutes, 0);
    const now = new Date();

    if (now.getTime() > slotEndTime.getTime()) {
      return res.status(400).json({
        success: false,
        message: 'This booking slot has already passed and the OTP is expired.'
      });
    }

    // Validate that check-in is within +/- 30 minutes of scheduled start time
    const [hours, minutes] = appointment.start_time.split(':').map(Number);
    const scheduledTime = new Date(yVal, mVal - 1, dVal, hours, minutes, 0);
    const diffMinutes = Math.abs(now.getTime() - scheduledTime.getTime()) / (60 * 1000);

    if (diffMinutes > 30) {
      return res.status(400).json({
        success: false,
        message: `Check-in is only allowed within 30 minutes before or after your scheduled start time (${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}). Please try again closer to your appointment time.`
      });
    }

    // Start appointment status
    await pool.query("UPDATE appointments SET status = 'in_progress' WHERE id = ?", [id]);
    
    // Add start notification
    await pool.query("INSERT INTO appointment_notifications (appointment_id, message) VALUES (?, 'OTP Verified. Service started successfully!')", [id]);

    res.json({ success: true, message: 'OTP verified. Service started successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 8b. Complete Service Route (No OTP required, initiated by barber)
app.post('/api/appointments/:id/complete', async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query('SELECT status FROM appointments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    const appointment = rows[0];
    if (appointment.status !== 'in_progress') {
      return res.status(400).json({ success: false, message: `Cannot complete service. Appointment status is ${appointment.status}.` });
    }

    // Complete appointment status
    await pool.query("UPDATE appointments SET status = 'completed' WHERE id = ?", [id]);
    
    // Add completion alert
    await pool.query("INSERT INTO appointment_notifications (appointment_id, message) VALUES (?, 'Service completed by barber.')", [id]);

    res.json({ success: true, message: 'Service marked completed.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 10. Submit Review & Update Barber Rating Route
app.post('/api/reviews', async (req, res) => {
  const { appointmentId, barberId, customerId, rating, comment } = req.body;

  if (!appointmentId || !barberId || !customerId || !rating) {
    return res.status(400).json({ success: false, message: 'appointmentId, barberId, customerId, and rating are required' });
  }

  const numericRating = Number(rating);
  if (numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Verify appointment is completed
    const [appRows] = await conn.query('SELECT status FROM appointments WHERE id = ?', [appointmentId]);
    if (appRows.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Appointment not found' });
    }

    if (appRows[0].status !== 'completed') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot review an uncompleted appointment.' });
    }

    // 2. Check if already reviewed
    const [existingReviews] = await conn.query('SELECT id FROM reviews WHERE appointment_id = ?', [appointmentId]);
    if (existingReviews.length > 0) {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Appointment has already been reviewed.' });
    }

    // 3. Insert review
    await conn.query(
      'INSERT INTO reviews (appointment_id, barber_id, customer_id, rating, comment) VALUES (?, ?, ?, ?, ?)',
      [appointmentId, barberId, customerId, numericRating, comment || null]
    );

    // 4. Update barber rating & reviews_count (running average)
    const [barberRows] = await conn.query('SELECT reviews_count, rating FROM barbers WHERE id = ?', [barberId]);
    if (barberRows.length > 0) {
      const b = barberRows[0];
      const originalCount = b.reviews_count;
      const originalRating = Number(b.rating);
      
      const newCount = originalCount + 1;
      const newRating = ((originalRating * originalCount) + numericRating) / newCount;
      const roundedRating = Math.round(newRating * 10) / 10;

      await conn.query(
        'UPDATE barbers SET rating = ?, reviews_count = ? WHERE id = ?',
        [roundedRating, newCount, barberId]
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Review submitted successfully!' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// 9. Patch Barber Delay status
app.patch('/api/barbers/:id/delay', async (req, res) => {
  const { id } = req.params;
  const { delayStatus } = req.body;

  if (!delayStatus) {
    return res.status(400).json({ success: false, message: 'delayStatus is required' });
  }

  try {
    await pool.query('UPDATE barbers SET delay_status = ? WHERE id = ?', [delayStatus, id]);
    res.json({ success: true, message: 'Delay updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.05 Update Barber Settings (operating hours, days off, tagline/title, capacity, and map URL)
app.put('/api/barbers/:id/settings', async (req, res) => {
  const { id } = req.params;
  const { openingTime, closingTime, workingDays, mapsUrl, lat, lon, title, chairsCount } = req.body;

  if (!openingTime || !closingTime || !workingDays || !mapsUrl) {
    return res.status(400).json({ success: false, message: 'openingTime, closingTime, workingDays, and mapsUrl are required' });
  }

  // Validate Google Maps URL format
  const isGoogleMaps = (url) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    return /google\..*\/maps/i.test(trimmed) || 
           /maps\.app\.goo\.gl/i.test(trimmed) || 
           /goo\.gl\/maps/i.test(trimmed);
  };
  if (!isGoogleMaps(mapsUrl)) {
    return res.status(400).json({ success: false, message: 'Invalid Google Maps URL link' });
  }

  try {
    // 1. Fetch current barber settings to check if location (mapsUrl) changed
    const [barberRows] = await pool.query('SELECT maps_url, chairs_count FROM barbers WHERE id = ?', [id]);
    if (barberRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Barber profile not found' });
    }

    const currentMapsUrl = barberRows[0].maps_url;
    const isLocationChanged = mapsUrl.trim().toLowerCase() !== currentMapsUrl.trim().toLowerCase();

    // Tagline/title default or updated value
    const updatedTitle = title ? title.trim() : 'Premium Professional Grooming';
    // Chairs / capacity count
    const updatedChairs = chairsCount !== undefined ? Number(chairsCount) : (barberRows[0].chairs_count || 2);

    if (isLocationChanged) {
      // If location changed, require reason
      const { reason } = req.body;
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Reason for location change is required' });
      }

      // Resolve proposed coordinates
      const resolved = await resolveMapsUrlAndCoords(mapsUrl, lat, lon);

      // Insert location change request
      await pool.query(
        `INSERT INTO location_change_requests (barber_id, proposed_maps_url, proposed_lat, proposed_lon, reason, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [id, resolved.mapsUrl, Number(resolved.lat), Number(resolved.lon), reason.trim()]
      );

      // Update schedule, tagline, and active staff/capacity immediately, but leave location unchanged in barbers table
      await pool.query(
        `UPDATE barbers 
         SET opening_time = ?, closing_time = ?, working_days = ?, title = ?, chairs_count = ? 
         WHERE id = ?`,
        [openingTime, closingTime, workingDays, updatedTitle, updatedChairs, id]
      );

      return res.json({ 
        success: true, 
        message: 'Schedule, capacity & tagline updated immediately. Location change request submitted for Admin approval!',
        locationChangePending: true 
      });
    }

    // If location did not change, update settings directly including tagline and capacity
    const resolved = await resolveMapsUrlAndCoords(mapsUrl, lat, lon);
    await pool.query(
      `UPDATE barbers 
       SET opening_time = ?, closing_time = ?, working_days = ?, maps_url = ?, lat = ?, lon = ?, title = ?, chairs_count = ? 
       WHERE id = ?`,
      [
        openingTime,
        closingTime,
        workingDays,
        resolved.mapsUrl,
        Number(resolved.lat),
        Number(resolved.lon),
        updatedTitle,
        updatedChairs,
        id
      ]
    );

    res.json({ success: true, message: 'Shop settings updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.05a Update Barber Shop Profile Image URL
app.put('/api/barbers/:id/profile-image', async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'Profile image URL is required' });
  }
  try {
    await pool.query('UPDATE barbers SET image_url = ? WHERE id = ?', [url.trim(), id]);
    res.json({ success: true, message: 'Shop profile image updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.05b Add Barber Portfolio Image
app.post('/api/barbers/:id/portfolio', async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'Portfolio image URL is required' });
  }
  try {
    // Determine the next display order (max + 1)
    const [rows] = await pool.query('SELECT MAX(display_order) as maxOrder FROM barber_portfolio WHERE barber_id = ?', [id]);
    const nextOrder = (rows[0] && rows[0].maxOrder !== null && rows[0].maxOrder !== undefined) ? rows[0].maxOrder + 1 : 0;

    await pool.query(
      'INSERT INTO barber_portfolio (barber_id, image_url, display_order) VALUES (?, ?, ?)',
      [id, url.trim(), nextOrder]
    );
    res.json({ success: true, message: 'Portfolio image added successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.05c Delete Barber Portfolio Image
app.delete('/api/barbers/:id/portfolio', async (req, res) => {
  const { id } = req.params;
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'Portfolio image URL is required' });
  }
  try {
    await pool.query('DELETE FROM barber_portfolio WHERE barber_id = ? AND image_url = ?', [id, url.trim()]);
    res.json({ success: true, message: 'Portfolio image deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.05d Update Barber Portfolio Images Display Order
app.put('/api/barbers/:id/portfolio/order', async (req, res) => {
  const { id } = req.params;
  const { imageUrls, urls } = req.body;
  const targetUrls = imageUrls || urls;
  if (!targetUrls || !Array.isArray(targetUrls)) {
    return res.status(400).json({ success: false, message: 'imageUrls array is required' });
  }
  try {
    // Sequentially update each image's display_order
    for (let i = 0; i < targetUrls.length; i++) {
      await pool.query(
        'UPDATE barber_portfolio SET display_order = ? WHERE barber_id = ? AND image_url = ?',
        [i, id, targetUrls[i].trim()]
      );
    }
    res.json({ success: true, message: 'Portfolio order updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.06 Admin Barber Profile Management Endpoint
app.put('/api/admin/barbers/:id', async (req, res) => {
  const { id } = req.params;
  const { name, title, specialty, openingTime, closingTime, workingDays, mapsUrl, lat, lon, location } = req.body;

  if (!name || !title || !specialty || !openingTime || !closingTime || !workingDays || !mapsUrl) {
    return res.status(400).json({ success: false, message: 'Missing required salon details' });
  }

  // Validate Google Maps URL format
  const isGoogleMaps = (url) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return false;
    return /google\..*\/maps/i.test(trimmed) || 
           /maps\.app\.goo\.gl/i.test(trimmed) || 
           /goo\.gl\/maps/i.test(trimmed);
  };
  if (!isGoogleMaps(mapsUrl)) {
    return res.status(400).json({ success: false, message: 'Invalid Google Maps URL link' });
  }

  try {
    const resolved = await resolveMapsUrlAndCoords(mapsUrl, lat, lon);
    const finalLocation = location || resolved.mapsUrl;

    const [result] = await pool.query(
      `UPDATE barbers 
       SET name = ?, title = ?, specialty = ?, opening_time = ?, closing_time = ?, working_days = ?, maps_url = ?, lat = ?, lon = ?, location = ?
       WHERE id = ?`,
      [
        name,
        title,
        specialty,
        openingTime,
        closingTime,
        workingDays,
        resolved.mapsUrl,
        Number(resolved.lat),
        Number(resolved.lon),
        finalLocation,
        id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Barber profile not found' });
    }

    res.json({ success: true, message: 'Salon details updated successfully by Admin!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.07 Admin: Fetch all location change requests
app.get('/api/admin/location-requests', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT r.*, b.name AS barber_name, b.maps_url AS current_maps_url, b.location AS current_location
       FROM location_change_requests r
       JOIN barbers b ON r.barber_id = b.id
       ORDER BY r.created_at DESC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.08 Admin: Approve a location change request
app.post('/api/admin/location-requests/:id/approve', async (req, res) => {
  const { id } = req.params;

  try {
    const [requestRows] = await pool.query('SELECT * FROM location_change_requests WHERE id = ?', [id]);
    if (requestRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Location request not found' });
    }
    const request = requestRows[0];

    if (request.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${request.status}` });
    }

    // Update barber profile with proposed location details
    await pool.query(
      `UPDATE barbers 
       SET maps_url = ?, lat = ?, lon = ? 
       WHERE id = ?`,
      [request.proposed_maps_url, request.proposed_lat, request.proposed_lon, request.barber_id]
    );

    // Mark request as approved
    await pool.query(
      `UPDATE location_change_requests SET status = 'approved' WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Location change request approved and applied successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.09 Admin: Reject a location change request
app.post('/api/admin/location-requests/:id/reject', async (req, res) => {
  const { id } = req.params;

  try {
    const [requestRows] = await pool.query('SELECT status FROM location_change_requests WHERE id = ?', [id]);
    if (requestRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Location request not found' });
    }

    if (requestRows[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: `Request is already ${requestRows[0].status}` });
    }

    await pool.query(
      `UPDATE location_change_requests SET status = 'rejected' WHERE id = ?`,
      [id]
    );

    res.json({ success: true, message: 'Location change request rejected.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.1 Barber service management: Add Service
app.post('/api/barbers/:barberId/services', async (req, res) => {
  const { barberId } = req.params;
  const { name, price, durationMinutes, category } = req.body;

  if (!name || price === undefined || durationMinutes === undefined) {
    return res.status(400).json({ success: false, message: 'Service name, price, and duration are required' });
  }

  const finalCategory = category || 'unisex';

  try {
    const serviceId = `s-${barberId}-${Date.now()}`;
    await pool.query(
      `INSERT INTO services (id, name, description, price, duration_minutes, barber_id, category) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        serviceId,
        name.trim(),
        `Premium ${name.trim()} service custom tailored for you.`,
        Number(price),
        Number(durationMinutes),
        barberId,
        finalCategory
      ]
    );
    res.status(201).json({
      success: true,
      message: 'Service added successfully!',
      service: {
        id: serviceId,
        name: name.trim(),
        description: `Premium ${name.trim()} service custom tailored for you.`,
        price: Number(price),
        durationMinutes: Number(durationMinutes),
        barberId,
        category: finalCategory
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.2 Barber service management: Update Service
app.put('/api/barbers/:barberId/services/:serviceId', async (req, res) => {
  const { barberId, serviceId } = req.params;
  const { name, price, durationMinutes, category } = req.body;

  if (!name || price === undefined || durationMinutes === undefined) {
    return res.status(400).json({ success: false, message: 'Service name, price, and duration are required' });
  }

  try {
    await pool.query(
      `UPDATE services 
       SET name = ?, price = ?, duration_minutes = ?, category = ? 
       WHERE id = ? AND barber_id = ?`,
      [name.trim(), Number(price), Number(durationMinutes), category || 'unisex', serviceId, barberId]
    );
    res.json({ success: true, message: 'Service updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 9.3 Barber service management: Delete Service
app.delete('/api/barbers/:barberId/services/:serviceId', async (req, res) => {
  const { barberId, serviceId } = req.params;

  try {
    await pool.query(
      'DELETE FROM services WHERE id = ? AND barber_id = ?',
      [serviceId, barberId]
    );
    res.json({ success: true, message: 'Service deleted successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// BARBER ONBOARDING & ADMIN PORTAL ROUTES
// ==========================================

// Onboarding 1: Apply / Resubmit Application
app.post('/api/onboarding/apply', async (req, res) => {
  const {
    shopName,
    ownerName,
    email,
    contactNumber,
    location,
    mapsUrl,
    lat,
    lon,
    chairsCount,
    openingTime,
    closingTime,
    workingDays,
    services
  } = req.body;

  if (
    !shopName || !ownerName || !email || !contactNumber || !location ||
    !mapsUrl || chairsCount === undefined ||
    !openingTime || !closingTime || !Array.isArray(services) || services.length === 0
  ) {
    return res.status(400).json({ success: false, message: 'All shop details, Google Maps URL, and at least one service are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid email address format' });
  }

  // Validate contact number (exactly 10 digits after stripping non-numeric characters)
  const cleanedContact = contactNumber.trim().replace(/\D/g, '');
  if (cleanedContact.length !== 10) {
    return res.status(400).json({ success: false, message: 'Contact number must be exactly 10 digits (e.g. 9876543210)' });
  }

  // Validate Google Maps URL format
  const isGoogleMaps = (url) => {
    const trimmed = url.trim();
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return false;
    }
    return /google\..*\/maps/i.test(trimmed) || 
           /maps\.app\.goo\.gl/i.test(trimmed) || 
           /goo\.gl\/maps/i.test(trimmed);
  };
  if (!isGoogleMaps(mapsUrl)) {
    return res.status(400).json({ success: false, message: 'Invalid Google Maps URL link' });
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Enforce OTP Email verification has succeeded
  try {
    const [verifyRows] = await pool.query(
      'SELECT verified FROM email_verifications WHERE email = ? AND verified = 1',
      [trimmedEmail]
    );
    if (verifyRows.length === 0) {
      return res.status(400).json({ success: false, message: 'Email verification is required. Please verify your email first.' });
    }
  } catch (verifyErr) {
    console.error("Database check for email verification failed:", verifyErr.message);
  }

  const conn = await pool.getConnection();

  try {
    const resolved = await resolveMapsUrlAndCoords(mapsUrl, lat, lon);

    await conn.beginTransaction();

    // Check if there is an existing application
    const [existing] = await conn.query('SELECT id, status FROM barber_applications WHERE email = ?', [trimmedEmail]);

    let applicationId;

    if (existing.length > 0) {
      const app = existing[0];
      if (app.status === 'approved') {
        await conn.rollback();
        return res.status(400).json({ success: false, message: 'An application with this email has already been approved' });
      }

      applicationId = app.id;
      // Update existing application
      await conn.query(
        `UPDATE barber_applications 
         SET shop_name = ?, owner_name = ?, contact_number = ?, location = ?, maps_url = ?, 
             lat = ?, lon = ?, chairs_count = ?, opening_time = ?, closing_time = ?, working_days = ?,
             status = 'pending', rejection_feedback = NULL 
         WHERE id = ?`,
        [
          shopName.trim(), ownerName.trim(), contactNumber.trim(), location.trim(), resolved.mapsUrl,
          Number(resolved.lat), Number(resolved.lon), Number(chairsCount), openingTime, closingTime,
          workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
          applicationId
        ]
      );

      // Clear existing services
      await conn.query('DELETE FROM application_services WHERE application_id = ?', [applicationId]);
    } else {
      // Create new application
      const [insertResult] = await conn.query(
        `INSERT INTO barber_applications 
         (shop_name, owner_name, email, contact_number, location, maps_url, lat, lon, chairs_count, opening_time, closing_time, working_days, status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          shopName.trim(), ownerName.trim(), trimmedEmail, contactNumber.trim(), location.trim(), resolved.mapsUrl,
          Number(resolved.lat), Number(resolved.lon), Number(chairsCount), openingTime, closingTime,
          workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'
        ]
      );
      applicationId = insertResult.insertId;
    }

    // Insert new services
    for (const service of services) {
      if (!service.name || service.price === undefined || service.durationMinutes === undefined) {
        throw new Error('Invalid service data: name, price, and durationMinutes are required');
      }
      await conn.query(
        `INSERT INTO application_services (application_id, name, price, duration_minutes, category) 
         VALUES (?, ?, ?, ?, ?)`,
        [applicationId, service.name.trim(), Number(service.price), Number(service.durationMinutes), service.category || 'unisex']
      );
    }

    await conn.commit();
    res.status(201).json({ success: true, message: 'Application submitted successfully!', applicationId });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// Onboarding 2: Check Status
app.get('/api/onboarding/status/:email', async (req, res) => {
  const { email } = req.params;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email parameter is required' });
  }

  try {
    const trimmedEmail = email.trim().toLowerCase();
    const [apps] = await pool.query('SELECT * FROM barber_applications WHERE email = ?', [trimmedEmail]);

    if (apps.length === 0) {
      return res.status(404).json({ success: false, message: 'No application found with this email' });
    }

    const app = apps[0];
    const [services] = await pool.query(
      'SELECT name, price, duration_minutes as durationMinutes, category FROM application_services WHERE application_id = ?',
      [app.id]
    );

    res.json({
      success: true,
      application: {
        id: app.id,
        shopName: app.shop_name,
        ownerName: app.owner_name,
        email: app.email,
        contactNumber: app.contact_number,
        location: app.location,
        mapsUrl: app.maps_url,
        lat: Number(app.lat),
        lon: Number(app.lon),
        chairsCount: app.chairs_count,
        openingTime: app.opening_time,
        closingTime: app.closing_time,
        workingDays: app.working_days,
        status: app.status,
        rejectionFeedback: app.rejection_feedback,
        createdAt: app.created_at,
        updatedAt: app.updated_at,
        services
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin 1: Fetch All Applications
app.get('/api/admin/applications', async (req, res) => {
  try {
    const [apps] = await pool.query('SELECT * FROM barber_applications ORDER BY created_at DESC');
    
    const formattedApps = await Promise.all(
      apps.map(async (app) => {
        const [services] = await pool.query(
          'SELECT name, price, duration_minutes as durationMinutes, category FROM application_services WHERE application_id = ?',
          [app.id]
        );
        return {
          id: app.id,
          shopName: app.shop_name,
          ownerName: app.owner_name,
          email: app.email,
          contactNumber: app.contact_number,
          location: app.location,
          mapsUrl: app.maps_url,
          lat: Number(app.lat),
          lon: Number(app.lon),
          chairsCount: app.chairs_count,
          openingTime: app.opening_time,
          closingTime: app.closing_time,
          workingDays: app.working_days,
          status: app.status,
          rejectionFeedback: app.rejection_feedback,
          createdAt: app.created_at,
          updatedAt: app.updated_at,
          services
        };
      })
    );

    res.json({ success: true, applications: formattedApps });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin 2: Edit Application Details (Inline Edit)
app.put('/api/admin/applications/:id', async (req, res) => {
  const { id } = req.params;
  const {
    shopName,
    ownerName,
    contactNumber,
    location,
    mapsUrl,
    lat,
    lon,
    chairsCount,
    openingTime,
    closingTime,
    workingDays,
    services
  } = req.body;

  if (
    !shopName || !ownerName || !contactNumber || !location || !mapsUrl ||
    chairsCount === undefined ||
    !openingTime || !closingTime || !Array.isArray(services) || services.length === 0
  ) {
    return res.status(400).json({ success: false, message: 'All shop details, Google Maps URL, and services are required for update' });
  }

  const conn = await pool.getConnection();

  try {
    const resolved = await resolveMapsUrlAndCoords(mapsUrl, lat, lon);

    await conn.beginTransaction();

    // Verify application exists and is not approved
    const [appCheck] = await conn.query('SELECT status FROM barber_applications WHERE id = ?', [id]);
    if (appCheck.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (appCheck[0].status === 'approved') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'Cannot edit an already approved application' });
    }

    // Update application
    await conn.query(
      `UPDATE barber_applications 
       SET shop_name = ?, owner_name = ?, contact_number = ?, location = ?, maps_url = ?, 
           lat = ?, lon = ?, chairs_count = ?, opening_time = ?, closing_time = ?, working_days = ? 
       WHERE id = ?`,
      [
        shopName.trim(), ownerName.trim(), contactNumber.trim(), location.trim(), resolved.mapsUrl,
        Number(resolved.lat), Number(resolved.lon), Number(chairsCount), openingTime, closingTime,
        workingDays || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
        id
      ]
    );

    // Delete existing services
    await conn.query('DELETE FROM application_services WHERE application_id = ?', [id]);

    // Insert updated services
    for (const service of services) {
      if (!service.name || service.price === undefined || service.durationMinutes === undefined) {
        throw new Error('Invalid service data');
      }
      await conn.query(
        `INSERT INTO application_services (application_id, name, price, duration_minutes, category) 
         VALUES (?, ?, ?, ?, ?)`,
        [id, service.name.trim(), Number(service.price), Number(service.durationMinutes), service.category || 'unisex']
      );
    }

    await conn.commit();
    res.json({ success: true, message: 'Application updated successfully!' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// Admin 3: Approve Application
app.post('/api/admin/applications/:id/approve', async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    // 1. Fetch application details
    const [apps] = await conn.query('SELECT * FROM barber_applications WHERE id = ?', [id]);
    if (apps.length === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: 'Application not found' });
    }

    const app = apps[0];
    if (app.status === 'approved') {
      await conn.rollback();
      return res.status(400).json({ success: false, message: 'This application is already approved' });
    }

    // 2. Fetch application services
    const [appServices] = await conn.query('SELECT * FROM application_services WHERE application_id = ?', [id]);

    const barberId = `b-${Date.now()}`;
    const mapsUrl = app.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(app.shop_name + ' ' + app.location)}`;

    // 3. Create Barber profile
    await conn.query(
      `INSERT INTO barbers 
       (id, name, title, specialty, rating, reviews_count, image_url, delay_status, location, maps_url, distance_meters, lead_stylist, lat, lon, chairs_count, opening_time, closing_time, working_days) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        barberId,
        app.shop_name,
        'Premium Professional Grooming',
        'Custom Styling & Grooming',
        5.0,
        1,
        'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&q=80&w=250&h=250',
        'On Time',
        app.location,
        mapsUrl,
        1500,
        app.owner_name,
        app.lat,
        app.lon,
        app.chairs_count,
        app.opening_time || '09:00',
        app.closing_time || '21:00',
        app.working_days || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'
      ]
    );

    // 4. Create Barber Services
    for (let idx = 0; idx < appServices.length; idx++) {
      const s = appServices[idx];
      const serviceId = `s-${barberId}-${idx}`;
      await conn.query(
        `INSERT INTO services (id, name, description, price, duration_minutes, barber_id, category) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          serviceId,
          s.name,
          `Premium ${s.name} service custom tailored for you.`,
          s.price,
          s.duration_minutes,
          barberId,
          s.category || 'unisex'
        ]
      );
    }

    // 5. Create Barber User Account
    const userId = `barber-user-${Date.now()}`;
    const generatedPassword = Math.random().toString(36).substring(2, 10);
    // Insert user (using On Duplicate Key Update to handle edge cases where email already exists in users)
    await conn.query(
      `INSERT INTO users (id, email, password, name, role, barber_id) 
       VALUES (?, ?, ?, ?, 'barber', ?) 
       ON DUPLICATE KEY UPDATE 
         role='barber', 
         password=VALUES(password),
         barber_id=VALUES(barber_id),
         name=VALUES(name)`,
      [
        userId,
        app.email.trim().toLowerCase(),
        generatedPassword,
        app.owner_name,
        barberId
      ]
    );

    // 6. Update application status
    await conn.query(
      'UPDATE barber_applications SET status = ?, rejection_feedback = NULL WHERE id = ?',
      ['approved', id]
    );

    await conn.commit();

    // 7. Send credentials email to the approved barber
    try {
      await sendMail({
        to: app.email.trim().toLowerCase(),
        subject: 'Welcome to Barbo - Your Salon Application has been Approved!',
        text: `Congratulations! Your salon "${app.shop_name}" has been approved on Barbo. You can log in using your registered email and the following temporary password: ${generatedPassword}. Please change your password from your settings dashboard after logging in.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
            <h2 style="color: #d4a359; text-transform: uppercase; margin-bottom: 20px; font-weight: 800;">WELCOME TO BARBO!</h2>
            <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Congratulations! Your salon <strong>"${app.shop_name}"</strong> has been approved on Barbo's premium grooming network.</p>
            <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Your partner user account has been successfully provisioned. You can access your settings dashboard and manage your salon appointments using the login credentials below:</p>
            
            <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin: 25px 0; border: 1px solid #334155; font-size: 0.95rem;">
              <p style="margin: 0 0 10px 0; color: #cbd5e1;"><strong>Portal URL:</strong> <a href="http://localhost:5173" style="color: #d4a359; text-decoration: underline;">Open Barbo App</a></p>
              <p style="margin: 0 0 10px 0; color: #cbd5e1;"><strong>Email:</strong> ${app.email.trim().toLowerCase()}</p>
              <p style="margin: 0; color: #cbd5e1;"><strong>Temporary Password:</strong> <strong style="color: #d4a359; font-family: monospace; font-size: 1.1rem;">${generatedPassword}</strong></p>
            </div>
            
            <p style="font-size: 0.9rem; color: #a1a1aa; line-height: 1.5; margin-top: 20px;"><em>Security Notice: Please remember to change your password immediately from your partner settings dashboard after logging in for the first time.</em></p>
          </div>
        `
      });
    } catch (mailErr) {
      console.error("Failed to send welcome credentials email:", mailErr.message);
    }

    res.json({ success: true, message: 'Application approved, barber profile and user account created successfully!' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: err.message });
  } finally {
    conn.release();
  }
});

// Admin 4: Reject Application
app.post('/api/admin/applications/:id/reject', async (req, res) => {
  const { id } = req.params;
  const { feedback } = req.body;

  if (!feedback || !feedback.trim()) {
    return res.status(400).json({ success: false, message: 'Rejection feedback is required' });
  }

  try {
    const [appCheck] = await pool.query('SELECT status FROM barber_applications WHERE id = ?', [id]);
    if (appCheck.length === 0) {
      return res.status(404).json({ success: false, message: 'Application not found' });
    }
    if (appCheck[0].status === 'approved') {
      return res.status(400).json({ success: false, message: 'Cannot reject an already approved application' });
    }

    await pool.query(
      'UPDATE barber_applications SET status = ?, rejection_feedback = ? WHERE id = ?',
      ['rejected', feedback.trim(), id]
    );

    res.json({ success: true, message: 'Application rejected with feedback.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Background notification job: Check every 10 seconds for appointments starting in ~30 minutes
const notifiedAppointments = new Set();
setInterval(async () => {
  try {
    const now = new Date();
    // Scan upcoming appointments in next 35 minutes (to cover offsets) but not already notified
    const [rows] = await pool.query(
      `SELECT a.*, u.email as customer_email, u.name as customer_name 
       FROM appointments a
       JOIN users u ON a.customer_id = u.id
       WHERE a.status = 'upcoming' AND a.date = ?`,
      [now.toISOString().split('T')[0]]
    );

    for (const app of rows) {
      if (notifiedAppointments.has(app.id)) continue;

      const [sH, sM] = app.start_time.split(':').map(Number);
      const appTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sH, sM, 0);
      const diffMinutes = (appTime.getTime() - now.getTime()) / (1000 * 60);

      // Trigger if starting in 25 to 30 minutes
      if (diffMinutes > 0 && diffMinutes <= 30.5) {
        notifiedAppointments.add(app.id);
        
        console.log(`⏰ Triggering 30-min booking reminder email for appointment ${app.id} to ${app.customer_email}`);
        
        await sendMail({
          to: app.customer_email,
          subject: `Reminder: Your Barbo Booking at ${app.barber_name} is in 30 minutes!`,
          text: `Hi ${app.customer_name},\n\nThis is a friendly reminder that you have a booking scheduled with ${app.barber_name} today at ${app.start_time}.\n\nLocation: ${app.location || 'Bhopal Shop'}\nOTP for check-in: ${app.travel_otp}\n\nHave a great haircut!\n- Barbo Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0f172a; color: #f8fafc; padding: 30px; border-radius: 12px; border: 1px solid #1e293b;">
              <h2 style="color: #d4a359; text-transform: uppercase; margin-bottom: 20px; font-weight: 800;">BOOKING REMINDER ⏰</h2>
              <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Hi <strong>${app.customer_name}</strong>,</p>
              <p style="font-size: 1rem; color: #cbd5e1; line-height: 1.6;">Your upcoming grooming appointment at <strong>${app.barber_name}</strong> starts in <strong>30 minutes</strong>.</p>
              
              <div style="background-color: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d4a359;">
                <p style="margin: 0 0 8px 0; font-size: 0.95rem; color: #94a3b8;">📅 <strong>Date:</strong> ${app.date}</p>
                <p style="margin: 0 0 8px 0; font-size: 0.95rem; color: #94a3b8;">⏰ <strong>Time:</strong> ${app.start_time} - ${app.end_time}</p>
                <p style="margin: 0 0 8px 0; font-size: 0.95rem; color: #94a3b8;">📍 <strong>Location:</strong> ${app.location || 'Bhopal Shop'}</p>
                <p style="margin: 12px 0 0 0; font-size: 1.1rem; color: #f8fafc;">🔑 <strong>Check-In OTP:</strong> <span style="color: #d4a359; font-weight: 700; font-size: 1.3rem; letter-spacing: 2px;">${app.travel_otp}</span></p>
              </div>

              <p style="font-size: 0.9rem; color: #94a3b8; line-height: 1.5; margin-top: 24px;">Please keep your OTP ready and present it to your stylist upon arrival at the shop to start your service.</p>
              <p style="font-size: 0.9rem; color: #94a3b8; line-height: 1.5;">See you soon!<br/><strong>Team Barbo</strong></p>
            </div>
          `
        });
      }
    }
  } catch (err) {
    console.error("Error in background booking reminder cron job:", err.message);
  }
}, 10000);

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 Barbo Node.js REST Server running at http://localhost:${PORT}`);
});
