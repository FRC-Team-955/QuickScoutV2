import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// const firebaseConfig = {
// apiKey: "AIzaSyDODo0jhKM_OC1Zdf6YuDBIOfMtPaIU2gU",
// authDomain: "quickscoutv2.firebaseapp.com",
// projectId: "quickscoutv2",
// storageBucket: "quickscoutv2.firebasestorage.app",
// messagingSenderId: "43642572752",
// appId: "1:43642572752:web:315037a72ac9a1f90df3d5",
// measurementId: "G-F2360Z6CXY",
// };
const firebaseConfig = JSON.parse(
atob(
  "eyJhcGlLZXkiOiJBSXphU3lET0RvMGpoS01fT0MxWmRmNll1" +
    "REJJT2ZNdFBhSVUyZ1UiLCJhdXRoRG9tYWluIjoicXVpY2" +
    "tzY291dHYyLmZpcmViYXNlYXBwLmNvbSIsInByb2plY3RJ" +
    "ZCI6InF1aWNrc2NvdXR2MiIsInN0b3JhZ2VCdWNrZXQiOi" +
    "JxdWlja3Njb3V0djIuZmlyZWJhc2VzdG9yYWdlLmFwcCIs" +
    "Im1lc3NhZ2luZ1NlbmRlcklkIjoiNDM2NDI1NzI3NTIiLC" +
    "JhcHBJZCI6IjE6NDM2NDI1NzI3NTI6d2ViOjMxNTAzN2E3" +
    "MmFjOWExZjkwZGYzZDUiLCJtZWFzdXJlbWVudElkIjoiRy" +
    "1GMjM2MFo2Q1hZIn0=",

));

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
