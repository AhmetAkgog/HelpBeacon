const { database } = require("firebase-functions/v1");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleAuth } = require("google-auth-library");
const serviceAccount = require("./helpbeacon-a3a42-55e1c302081e.json"); // ⬅️ This is your downloaded key

admin.initializeApp();

exports.notifyFriendsOnEmergency = database
  .ref("/emergencies/{deviceId}")
  .onWrite(async (change, context) => {
    const data = change.after.val();
    if (!data || !data.uid) return null;

    const emergencyUid = data.uid;

    // 1. Get friend list of the emergency user
    const friendListSnap = await admin.database().ref(`/friendships/${emergencyUid}/friendList`).once("value");
    const friendList = friendListSnap.val() || [];

    if (friendList.length === 0) return null;

    // 2. Load FCM tokens of those friends
    const tokens = [];
    for (const friendUid of friendList) {
      const tokenSnap = await admin.database().ref(`/tokens/${friendUid}`).once("value");
      const token = tokenSnap.val();
      if (token) tokens.push(token);
    }

    if (tokens.length === 0) return null;

    // 3. Notification payload
    const payload = {
      notification: {
        title: "🚨 Friend in Emergency",
        body: "One of your friends just triggered an emergency alert.",
      }
    };

    // 4. Send notifications using HTTP v1
    const auth = new GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
    });

    const accessToken = await auth.getAccessToken();
    const url = `https://fcm.googleapis.com/v1/projects/helpbeacon-a3a42/messages:send`;

    for (const token of tokens) {
      const message = {
        message: {
          token,
          notification: payload.notification,
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken.token || accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to send to ${token}: ${errorText}`);
      } else {
        console.log(`✅ Notification sent to ${token}`);
      }
    }

    return null;
  });