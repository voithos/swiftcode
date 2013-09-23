var settings = {};

// Note: when running this app in OpenShift, most of these
// configuration options are overridden with their corresponding
// OpenShift environment variables

// HTTP server's (and WebSocket server's) settings
settings.ipaddress = '127.0.0.1';
settings.port = 8080;

// The secret salt used to generate session tokens.
// Set this to a falsy value (i.e. null)
// to have it be auto-generated on startup.
settings.sessionSecret = '<Change this to a secret string>';

// Database settings
settings.dbname = 'swiftcode';
settings.dbhost = 'localhost';
settings.dbport = 27017; // Default MongoDB port
settings.dbusername = '<username>';
settings.dbpassword = '<password>';

module.exports = settings;
