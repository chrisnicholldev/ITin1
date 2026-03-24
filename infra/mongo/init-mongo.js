// Runs on first startup when MONGO_INITDB_DATABASE is set
// Creates the application user with readWrite on the itdesk database

db = db.getSiblingDB('itdesk');

db.createUser({
  user: 'itdesk_user',
  pwd: process.env.MONGO_APP_PASSWORD || 'changeme',
  roles: [{ role: 'readWrite', db: 'itdesk' }],
});

print('MongoDB: itdesk database and user created');
