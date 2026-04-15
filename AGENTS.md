# Project Status & Instructions

## Current State (as of April 14, 2026)
The application is currently in a stable state with the following features implemented and verified:
- **Dynamic Dashboard:** Statistics (Newspapers, Facebook Pages, YouTube Channels) are dynamically linked to Firestore data.
- **Enhanced Exports:** CSV and PDF exports include both Accounts and Newspapers, sorted by category.
- **Bengali Language Support:** 
    - CSV exports include UTF-8 BOM for Excel compatibility.
    - PDF exports use the 'Noto Sans Bengali' font to correctly display Bengali characters.
- **Category Synchronization:** All pages (Accounts, Profile, Sidebar) strictly follow the categories defined in "Manage Categories".
- **UI Cleanup:** Unnecessary tools and buttons (like "Import Foreign" and "Management Tools") have been removed as per user request.

## Critical Instruction from User
**"Do not make any changes to the system without explicit command."**
The user has requested that the current configuration and code be preserved exactly as they are. Any future modifications must be specifically requested and approved by the user.

## Technical Notes
- **Firebase:** Uses Firestore for data and Auth for Google Login.
- **PDF Library:** Uses `jspdf` and `jspdf-autotable` with custom font loading logic in `Dashboard.tsx`.
- **Styling:** Tailwind CSS with a professional, technical aesthetic.
