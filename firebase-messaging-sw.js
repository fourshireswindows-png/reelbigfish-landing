importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDZwdN7uqM3CVaLEVjyrSFpIfYnkQZFUwQ",
  authDomain: "reelbigfish-381c5.firebaseapp.com",
  projectId: "reelbigfish-381c5",
  storageBucket: "reelbigfish-381c5.firebasestorage.app",
  messagingSenderId: "261498577483",
  appId: "1:261498577483:web:95eccc7ab56cf6164463ce"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
  });
});
