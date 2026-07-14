const mongoose = require('mongoose');
const { db, isRealFirebase } = require('../config/firebase');
const { readDb, writeDb } = require('./dbJson');

// Helper to check if MongoDB is active and connected
const isMongoConnected = () => {
  return mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db;
};

// Helper to sanitize Firestore documents
const formatDoc = (doc) => {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
};

// 1. Fetch all videos
const getVideos = async (query = {}) => {
  const { category } = query;

  if (isRealFirebase) {
    try {
      let ref = db.collection('videos');
      if (category && category !== 'All') {
        ref = ref.where('category', '==', category);
      }
      const snapshot = await ref.get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (err) {
      console.error('Firestore getVideos error:', err.message);
    }
  }

  // MongoDB active fallback
  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('videos');
      let filter = {};
      if (category && category !== 'All') {
        filter.category = category;
      }
      return await dbCol.find(filter).toArray();
    } catch (err) {
      console.error('MongoDB getVideos error:', err.message);
    }
  }

  // Fallback JSON DB
  const localDb = readDb();
  let list = Object.values(localDb.videos || {});
  if (category && category !== 'All') {
    list = list.filter(v => v.category === category);
  }
  return list;
};

// 2. Fetch video by ID
const getVideoById = async (id) => {
  if (isRealFirebase) {
    try {
      const doc = await db.collection('videos').doc(id).get();
      return formatDoc(doc);
    } catch (err) {
      console.error('Firestore getVideoById error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('videos');
      return await dbCol.findOne({ id });
    } catch (err) {
      console.error('MongoDB getVideoById error:', err.message);
    }
  }

  const localDb = readDb();
  return localDb.videos[id] || null;
};

// 3. Create video
const createVideo = async (id, videoData) => {
  if (isRealFirebase) {
    try {
      await db.collection('videos').doc(id).set(videoData);
    } catch (err) {
      console.error('Firestore createVideo error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('videos');
      const data = { _id: id, id, ...videoData };
      await dbCol.updateOne({ id }, { $set: data }, { upsert: true });
      return data;
    } catch (err) {
      console.error('MongoDB createVideo error:', err.message);
    }
  }

  const localDb = readDb();
  localDb.videos[id] = { id, ...videoData };
  writeDb(localDb);
  return localDb.videos[id];
};

// 4. Update video fields
const updateVideo = async (id, updates) => {
  if (isRealFirebase) {
    try {
      const ref = db.collection('videos').doc(id);
      await ref.update(updates);
    } catch (err) {
      console.error('Firestore updateVideo error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('videos');
      await dbCol.updateOne({ id }, { $set: updates });
      return await dbCol.findOne({ id });
    } catch (err) {
      console.error('MongoDB updateVideo error:', err.message);
    }
  }

  const localDb = readDb();
  if (localDb.videos[id]) {
    localDb.videos[id] = { ...localDb.videos[id], ...updates };
    writeDb(localDb);
    return localDb.videos[id];
  }
  return null;
};

// 5. Delete video
const deleteVideo = async (id) => {
  if (isRealFirebase) {
    try {
      await db.collection('videos').doc(id).delete();
    } catch (err) {
      console.error('Firestore deleteVideo error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('videos');
      const res = await dbCol.deleteOne({ id });
      return res.deletedCount > 0;
    } catch (err) {
      console.error('MongoDB deleteVideo error:', err.message);
    }
  }

  const localDb = readDb();
  if (localDb.videos[id]) {
    delete localDb.videos[id];
    writeDb(localDb);
    return true;
  }
  return false;
};

// 6. Fetch comments for a video
const getComments = async (videoId) => {
  if (isRealFirebase) {
    try {
      const snapshot = await db
        .collection('comments')
        .where('video', '==', videoId)
        .get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return list;
    } catch (err) {
      console.error('Firestore getComments error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('comments');
      const list = await dbCol.find({ video: videoId }).toArray();
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return list;
    } catch (err) {
      console.error('MongoDB getComments error:', err.message);
    }
  }

  const localDb = readDb();
  const comments = Object.values(localDb.comments || {})
    .filter(c => c.video === videoId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return comments;
};

// 7. Add a comment
const addComment = async (commentData) => {
  const commentId = Math.random().toString(36).substring(2, 11);
  const data = { id: commentId, ...commentData, createdAt: new Date().toISOString() };

  if (isRealFirebase) {
    try {
      await db.collection('comments').doc(commentId).set(data);
    } catch (err) {
      console.error('Firestore addComment error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('comments');
      const mongoData = { _id: commentId, ...data };
      await dbCol.insertOne(mongoData);
      return data;
    } catch (err) {
      console.error('MongoDB addComment error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.comments) localDb.comments = {};
  localDb.comments[commentId] = data;
  writeDb(localDb);
  return data;
};

// 8. Fetch user by ID
const getUserById = async (id) => {
  if (isRealFirebase) {
    try {
      const doc = await db.collection('users').doc(id).get();
      return formatDoc(doc);
    } catch (err) {
      console.error('Firestore getUserById error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('users');
      return await dbCol.findOne({ id });
    } catch (err) {
      console.error('MongoDB getUserById error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.users) localDb.users = {};
  return localDb.users[id] || null;
};

// 9. Fetch user by email
const getUserByEmail = async (email) => {
  if (isRealFirebase) {
    try {
      const snapshot = await db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
      if (snapshot.empty) return null;
      let user = null;
      snapshot.forEach(doc => { user = { id: doc.id, ...doc.data() }; });
      return user;
    } catch (err) {
      console.error('Firestore getUserByEmail error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('users');
      return await dbCol.findOne({ email: email.toLowerCase() });
    } catch (err) {
      console.error('MongoDB getUserByEmail error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.users) localDb.users = {};
  return Object.values(localDb.users).find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
};

// 10. Fetch user by username
const getUserByUsername = async (username) => {
  if (isRealFirebase) {
    try {
      const snapshot = await db.collection('users').where('username', '==', username).limit(1).get();
      if (snapshot.empty) return null;
      let user = null;
      snapshot.forEach(doc => { user = { id: doc.id, ...doc.data() }; });
      return user;
    } catch (err) {
      console.error('Firestore getUserByUsername error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('users');
      return await dbCol.findOne({ username });
    } catch (err) {
      console.error('MongoDB getUserByUsername error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.users) localDb.users = {};
  return Object.values(localDb.users).find(u => u.username === username) || null;
};

// 11. Create user
const createUser = async (id, userData) => {
  const data = { id, ...userData, email: userData.email.toLowerCase() };
  if (isRealFirebase) {
    try {
      await db.collection('users').doc(id).set(data);
    } catch (err) {
      console.error('Firestore createUser error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('users');
      const mongoData = { _id: id, ...data };
      await dbCol.updateOne({ id }, { $set: mongoData }, { upsert: true });
      return data;
    } catch (err) {
      console.error('MongoDB createUser error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.users) localDb.users = {};
  localDb.users[id] = data;
  writeDb(localDb);
  return data;
};

// 12. Update user
const updateUser = async (id, updates) => {
  if (isRealFirebase) {
    try {
      const ref = db.collection('users').doc(id);
      await ref.update(updates);
    } catch (err) {
      console.error('Firestore updateUser error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('users');
      await dbCol.updateOne({ id }, { $set: updates });
      return await dbCol.findOne({ id });
    } catch (err) {
      console.error('MongoDB updateUser error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.users) localDb.users = {};
  if (localDb.users[id]) {
    localDb.users[id] = { ...localDb.users[id], ...updates };
    writeDb(localDb);
    return localDb.users[id];
  }
  return null;
};

// 13. Fetch pending youtube notifications
const getPendingNotifications = async (limitVal = 5) => {
  if (isRealFirebase) {
    try {
      const snapshot = await db.collection('youtube_notifications')
        .where('status', '==', 'Pending')
        .limit(limitVal)
        .get();
      const list = [];
      snapshot.forEach(doc => list.push({ id: doc.id, ...doc.data() }));
      return list;
    } catch (err) {
      console.error('Firestore getPendingNotifications error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('youtube_notifications');
      return await dbCol.find({ status: 'Pending' }).limit(limitVal).toArray();
    } catch (err) {
      console.error('MongoDB getPendingNotifications error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.youtube_notifications) localDb.youtube_notifications = {};
  const list = Object.values(localDb.youtube_notifications)
    .filter(n => n.status === 'Pending')
    .slice(0, limitVal);
  return list;
};

// 14. Create youtube notification
const createNotification = async (videoId, data) => {
  const finalData = { videoId, status: 'Pending', createdAt: new Date().toISOString(), ...data };
  if (isRealFirebase) {
    try {
      await db.collection('youtube_notifications').doc(videoId).set(finalData);
    } catch (err) {
      console.error('Firestore createNotification error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('youtube_notifications');
      const mongoData = { _id: videoId, ...finalData };
      await dbCol.updateOne({ videoId }, { $set: mongoData }, { upsert: true });
      return finalData;
    } catch (err) {
      console.error('MongoDB createNotification error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.youtube_notifications) localDb.youtube_notifications = {};
  localDb.youtube_notifications[videoId] = finalData;
  writeDb(localDb);
  return finalData;
};

// 15. Update youtube notification
const updateNotification = async (videoId, updates) => {
  if (isRealFirebase) {
    try {
      const ref = db.collection('youtube_notifications').doc(videoId);
      await ref.update(updates);
    } catch (err) {
      console.error('Firestore updateNotification error:', err.message);
    }
  }

  if (isMongoConnected()) {
    try {
      const dbCol = mongoose.connection.db.collection('youtube_notifications');
      await dbCol.updateOne({ videoId }, { $set: updates });
      return await dbCol.findOne({ videoId });
    } catch (err) {
      console.error('MongoDB updateNotification error:', err.message);
    }
  }

  const localDb = readDb();
  if (!localDb.youtube_notifications) localDb.youtube_notifications = {};
  if (localDb.youtube_notifications[videoId]) {
    localDb.youtube_notifications[videoId] = { ...localDb.youtube_notifications[videoId], ...updates };
    writeDb(localDb);
    return localDb.youtube_notifications[videoId];
  }
  return null;
};

module.exports = {
  getVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
  getComments,
  addComment,
  getUserById,
  getUserByEmail,
  getUserByUsername,
  createUser,
  updateUser,
  getPendingNotifications,
  createNotification,
  updateNotification
};
