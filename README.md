# 👁️ Eye Blink Tracker

A highly polished, real-time web application styled with modern aesthetics (supporting both light and dark modes) that uses computer vision to track user eye blinks, calculate blink rates (Blinks Per Minute), and provide biological recommendations.

**Live Application Link:** [https://eye-blink-tracker-828103006265.asia-southeast1.run.app](https://eye-blink-tracker-828103006265.asia-southeast1.run.app)

---

## 💡 Why This Application Exists & What It Solves

Modern lifestyles require us to spend hours looking at digital monitors, laptops, and smartphones. This behavior leads directly to **Computer Vision Syndrome (CVS)** and **Digital Eye Strain**. 

### The Problem: The "Screen Stare" Effect
* Under normal circumstances, humans naturally blink about **15 to 20 times per minute**.
* When looking at a screen, this rate drops dramatically by up to **66%**, resulting in only **5 to 7 blinks per minute**.
* We also engage in "incomplete blinking" where the eyelids do not fully meet, preventing tear-film activation.

### The Solution: Eye Blink Tracker
This application aims to restore ocular health. By acting as a non-intrusive personal companion during screen sessions, it:
* Uses a browser-sandboxed web camera stream.
* Implements advanced face landmark tracking via **Google MediaPipe Face Mesh** to instantly detect eye-blink coordinates.
* Tracks your session duration and computes an objective **Blink Health Score (out of 10)**.
* Offers real-time feedback with warnings, recommendations, and doctors' alerts if your blinking frequency drops to dangerous thresholds.

---

## ⚕️ The Science: Why We Must Keep Our Blink Count Higher

Blinking is a crucial biological mechanism that preserves optical clarity and physiological resilience. Maintaining an optimal blink rate of **12–15+ blinks per minute** is vital for several reasons:

1. **Lubricating the Cornea (The Tear Film)**
   Every time you blink, a fresh layer of tear film (composed of water, mucus, and oils) is spread over the outer layer of your eye. This maintains lubrication, preventing dry eye syndrome, redness, and corneal microscopic abrasions.

2. **Preventing Meibomian Gland Dysfunction (MGD)**
   Along the edge of our eyelids reside the meibomian glands, which secrete essential lipid oils preventing your tear water from evaporating. Fully completed, high-frequency blinks physically squeeze these glands to release oil. Low blink rates lead to MGD—where the glands clog, dry out, and cause permanent ocular discomfort.

3. **Clearing Detritus and Oxygenating Cells**
   The cornea has no blood vessels; it receives oxygen directly from the surrounding air dissolved in the tear film. Frequent blinking replenishes this oxygen supply and washes away airborne irritants, dust, and toxic particles.

4. **Reducing Mental Fatigue and Refreshing Vision**
   Ocular dry-out causes micro-flickering in your focus, forcing your brain to work harder to decode blurry text. Higher blinking rates keep your optical surface perfectly spherical, improving vision crispness and reducing headaches.

---

## 🎯 Target Audiences

* **Software Engineers & Tech Professionals:** Prolonged concentration on code blocks suppresses natural blinking reflexes.
* **Remote Employees & Writers:** Constant text editing on computer interfaces.
* **Students & Researchers:** Reading online manuals, textbooks, and taking long online courses.
* **Gamers & Creators:** Fast-paced action demands high focus, leading to extreme visual strain and low blink frequency.

---

## ⚙️ Features

* **Real-time Web Face Tracking:** Zero servers involved. Your camera stream is processed locally inside your web browser sandbox using WebAssembly (WASM).
* **Responsive Light & Dark Theme Support:** Easily toggle between light and dark modes with the high-contrast toggle button styled with Lucide icons.
* **Biological Scoring Algorithm:** Provides a scale from 1 (Critical) to 10 (Excellent) in accordance with clinical criteria.
* **Interactive Sessions:** Customize tracking sessions (e.g., 30s, 60s, or 120s) with micro-animations and smooth progress indicators.
* **Clinical Warnings:** Triggers custom prompts if score indices reflect a critical dry-eye hazard requiring actual clinical evaluation.

---

## 🚀 How to Clone and Run Locally

Ensure you have [Node.js](https://nodejs.org/) installed on your computer.

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/eye-blink-tracker.git
cd eye-blink-tracker
```

### 2. Install Project Dependencies
```bash
npm install
```

### 3. Start the Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) using your web browser to view, iterate, and run your tracking session.

### 4. Build for Production
To bundle and deploy the static app or build the unpackaged Chrome Extension:
```bash
npm run build
```
The output assets and extension-specific manifests will be compiled directly in the `/dist` folder.

---

## 🧩 How to Load as a Chrome Extension

Since the application contains native extension supports (`manifest.json`, background service workers, and offscreen canvas documents), you can load it directly into Google Chrome as an Unpacked Extension:

1. **Build the extension**:
   Run `npm run build` locally. This creates the `/dist` directory containing all pre-requisite code modules.
2. **Open Chrome Extensions Manager**:
   Open a new tab in Google Chrome and navigate to: `chrome://extensions/`
3. **Enable Developer Mode**:
   In the upper-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.
4. **Load the Unpacked Folder**:
   Click the **Load unpacked** button in the top-left corner.
5. **Select the Directory**:
   In the file selection dialog, navigate to your cloned repository and select the **`/dist`** folder.
6. **Pin the Extension**:
   Click the Extension puzzle-piece icon in your Chrome toolbar and pin **Eye Blink Tracker**. Click the icon to open your popup and begin tracking blinks seamlessly in the background!

---

## 🛡️ Privacy First
No video or biometric face data leaves your device. All calculations are executed synchronously via the client-side Google MediaPipe WebAssembly module inside your browser. No image data is stored, cached, or transmitted over the network.
