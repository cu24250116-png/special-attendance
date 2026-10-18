# 📱 Special Attendance & Assignments - Mobile App (APK & Play Store)

---

## 📦 Download Artifacts

| Artifact | File Path | Format | Size | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Android APK (Direct Install)** | `apk/SpecialAttendance.apk` | `.apk` | ~3.85 MB | Phone me direct download & install karne ke liye |
| **Google Play Bundle (Store Live)** | `apk/SpecialAttendance.aab` | `.aab` | ~2.88 MB | Google Play Console par upload karke live karne ke liye |

---

## 📥 Option 1: Mobile Me Direct Install Kaise Karein (Phone Setup)

### Tarika A: Direct USB / File Transfer
1. Apne phone ko PC se connect karein ya `apk/SpecialAttendance.apk` ko WhatsApp/Google Drive/Bluetooth ke zariye apne mobile me send karein.
2. File Manager me jakar `SpecialAttendance.apk` par tap karein.
3. Agar *"Install unknown apps"* ka popup aaye toh **Settings** par tap karein aur **"Allow from this source"** enable karein.
4. **Install** par tap karein. App install ho jayegi!

### Tarika B: Mobile Browser se Direct Download (Same Wi-Fi Network)
1. Make sure aapka PC aur Mobile same Wi-Fi par connected hain.
2. Mobile browser me open karein:
   ```
   http://10.111.193.91:5000/download/SpecialAttendance.apk
   ```
   *(Local PC par: `http://localhost:5000/download/SpecialAttendance.apk`)*
3. APK download ho jayegi, tap karke install karein.

---

## 🎨 Mobile Alignment & UI Architecture

App ko mobile ke hardware aur screen aspect ratios ke hisaab se 100% properly align kiya gaya hai:

1. **Safe-Area Insets Support (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`)**:
   - Punch-hole camera, notch aur Android bottom navigation bar ke peeche content cut nahi hota.
2. **Viewport Configuration**:
   - `viewport-fit=cover`, `maximum-scale=1.0`, `user-scalable=no` taaki native app jaisa experience mile without unwanted horizontal scrolling or pinch-zoom glitch.
3. **Responsive Glassmorphism & Dark Aesthetic**:
   - Slate & emerald dark theme (#030712 / #0f172a), high-contrast badges, dynamic percentage meter, card layouts mobile touch-targets ke anuroop (48px+ minimum touch area).
4. **Android Native Theme**:
   - `colorPrimary` & `colorPrimaryDark` match the deep space blue theme (#030712) for seamless status-bar integration.

---

## 🚀 Option 2: Google Play Store Par Live Kaise Karein (Step-by-Step)

Google Play Store par app publish karne ke liye Google App Bundle (`.aab`) require karta hai. Humne `SpecialAttendance.aab` compile kar diya hai.

### Step 1: Google Play Console Account
1. [Google Play Console](https://play.google.com/console) par login karein.
2. **"Create App"** button par click karein:
   - **App Name:** `Special Attendance`
   - **Default Language:** English (United States) ya English (India)
   - **App or Game:** App
   - **Free or Paid:** Free

### Step 2: App Release me `.aab` Upload Karein
1. Left sidebar me **Production** (ya **Internal Testing**) par jayein.
2. **"Create new release"** par click karein.
3. **App bundles** section me drag & drop karein:
   ```
   c:\Users\rahul\OneDrive\Desktop\Special Attendence\apk\SpecialAttendance.aab
   ```
4. **Release name:** `1.0.0 (1)`
5. **Release notes:**
   ```
   Initial production release of College Special Attendance & Assignment Tracker for students and faculty.
   ```

### Step 3: Package & Technical Compliance Details
- **Package ID:** `com.college.specialattendance`
- **Target SDK:** `34` (Android 14 - Google Play requirement fully satisfied)
- **Min SDK:** `24` (Android 7.0 Nougat - 99.5%+ all active Android devices supported)
- **Permissions:**
  - `android.permission.INTERNET` (Network communication with college attendance backend)
  - `android.permission.ACCESS_NETWORK_STATE` (Check connectivity)

### Step 4: Signing Key (Optional Custom Keystore)
Google Play App Signing Google Console me automatically handle ho jati hai. Agar aapko custom upload keystore chahiye toh project root me command run kar sakte hain:
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v -keystore release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias specialattendance
```

### Step 5: Store Listing (Graphics & Description)
1. **Short Description (80 chars max):**
   *Track your college attendance, special exam dates, and assignment submissions.*
2. **Full Description:**
   *Special Attendance is the official portal for college students to view daily attendance records, monitor 5-day trends, check special class status, calculate target attendance percentages, and track assignment submissions seamlessly.*
3. **App Icon:** 512 x 512 PNG (transparent background)
4. **Feature Graphic:** 1024 x 500 PNG/JPEG
5. **Screenshots:** 2 to 8 phone screenshots (1080 x 1920 or 1080 x 2400) from Student Dashboard and Admin Panel.

---

## 🛠️ Project Directory Structure

```
Special Attendence/
├── apk/
│   ├── SpecialAttendance.apk     <-- Installable APK on Phone (3.85 MB)
│   ├── SpecialAttendance.aab     <-- Play Store Release Bundle (2.88 MB)
│   └── README.md                 <-- Publishing & Installation Guide
├── client/
│   ├── android/                  <-- Native Android Studio Project
│   │   ├── app/
│   │   │   ├── build.gradle      <-- Target SDK 34, Min SDK 24, Package ID
│   │   │   └── src/main/AndroidManifest.xml
│   │   └── gradlew.bat
│   └── src/                      <-- React + Vite PWA frontend
└── server/                       <-- Express + SQLite Backend
    ├── index.js                  <-- Serves /download/SpecialAttendance.apk
    └── data/                     <-- Persistent database
```
