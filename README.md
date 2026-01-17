# ATLAS - Library Archives System

## 🔥 Firebase Setup Complete!

Dein Firebase Projekt ist konfiguriert mit:
- ✅ Firestore Database (europe-west3)
- ✅ Authentication (E-Mail/Passwort)
- ✅ Web App registriert

## 📁 Dateien

```
atlas-firebase/
├── index.html          # Komplette Web-App mit Firebase
├── firestore.rules     # Sicherheitsregeln für Firestore
└── README.md           # Diese Datei
```

## 🚀 So startest du die Web-App

### Option 1: Direkt im Browser öffnen
Einfach `index.html` doppelklicken - funktioniert sofort!

### Option 2: Mit lokalem Server (empfohlen)
```bash
# Im Ordner atlas-firebase:
npx serve .
# Oder:
python -m http.server 8000
```

## 🔒 Firestore Regeln aktivieren

1. Geh zu Firebase Console → Firestore Database → Regeln
2. Ersetze den Inhalt mit dem Code aus `firestore.rules`
3. Klick "Veröffentlichen"

**Wichtig:** Die Testmodus-Regeln laufen nach 30 Tagen ab!

## 📱 Nächste Schritte: Mobile Apps

### Android App
```kotlin
// build.gradle (app)
implementation platform('com.google.firebase:firebase-bom:32.7.0')
implementation 'com.google.firebase:firebase-auth-ktx'
implementation 'com.google.firebase:firebase-firestore-ktx'
```

### iOS App
```swift
// Podfile
pod 'FirebaseAuth'
pod 'FirebaseFirestore'
```

Beide Apps verbinden sich mit derselben Datenbank!

## 🗄️ Datenbank-Struktur

```
firestore/
├── documents/
│   └── {docId}
│       ├── title: string
│       ├── type: string
│       ├── size: string
│       ├── userId: string
│       └── createdAt: timestamp
│
├── folders/
│   └── {folderId}
│       ├── name: string
│       ├── parent: string | null
│       └── userId: string
│
└── users/
    └── {userId}
        ├── email: string
        └── createdAt: timestamp
```

## 🔑 Firebase Config

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyDrrnWy5d5tlHLxi965WGc_7Gs3GIXY0Qw",
    authDomain: "atlas-4e16d.firebaseapp.com",
    projectId: "atlas-4e16d",
    storageBucket: "atlas-4e16d.firebasestorage.app",
    messagingSenderId: "494472010986",
    appId: "1:494472010986:web:9659fd71b4bcede8770b93"
};
```

Diese Config wird in allen Apps (Web, Android, iOS) verwendet!

---

Made with 🖤 for ATLAS
