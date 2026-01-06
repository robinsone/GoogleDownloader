const fs = require('fs-extra');
const { google } = require('googleapis');
const readline = require('readline');
const config = require('./config');
const logger = require('./logger');

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

class GoogleAuth {
  constructor() {
    this.oAuth2Client = null;
  }

  async authorize() {
    try {
      const credentials = await this.loadCredentials();
      const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

      this.oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        redirect_uris[0]
      );

      // Check if we have a token already
      const token = await this.loadToken();
      if (token) {
        this.oAuth2Client.setCredentials(token);
        return this.oAuth2Client;
      }

      // Get new token
      return await this.getNewToken();
    } catch (error) {
      logger.error('Authorization failed:', error);
      throw error;
    }
  }

  async loadCredentials() {
    const credPath = config.getCredentialsPath();
    if (!fs.existsSync(credPath)) {
      throw new Error(
        'credentials.json not found. Please download it from Google Cloud Console and place it in the config folder.'
      );
    }
    return JSON.parse(fs.readFileSync(credPath, 'utf8'));
  }

  async loadToken() {
    const tokenPath = config.getTokenPath();
    if (fs.existsSync(tokenPath)) {
      return JSON.parse(fs.readFileSync(tokenPath, 'utf8'));
    }
    return null;
  }

  async saveToken(token) {
    const tokenPath = config.getTokenPath();
    fs.writeFileSync(tokenPath, JSON.stringify(token));
    logger.info('Token saved successfully');
  }

  async getNewToken() {
    const authUrl = this.oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('\n=================================');
    console.log('Authorize this app by visiting: ');
    console.log(authUrl);
    console.log('=================================\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question('Enter the code from that page here: ', async (code) => {
        rl.close();
        try {
          const { tokens } = await this.oAuth2Client.getToken(code);
          this.oAuth2Client.setCredentials(tokens);
          await this.saveToken(tokens);
          resolve(this.oAuth2Client);
        } catch (error) {
          reject(new Error(`Error retrieving access token: ${error.message}`));
        }
      });
    });
  }

  getClient() {
    return this.oAuth2Client;
  }
}

module.exports = new GoogleAuth();
