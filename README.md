# The Grand Residences

A web application for browsing luxury apartments, featuring real-time filtering, Firebase authentication, Firestore for data storage, and a responsive frontend.

## Features
- User authentication (login/register) using Firebase Auth
- Apartment listings with filtering by offer type, flat type, price, and favorites
- Responsive design with modals, lightbox gallery, and toast notifications
- Recently viewed apartments and testimonials
- Contact form for inquiries
- Currency conversion for prices

## Tech Stack
- **Frontend**: HTML, CSS (with Tailwind-like utilities), JavaScript
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **Server**: Node.js with Express.js
- **Dependencies**: See `package.json` (Express v5.1.0)

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/daksh541/grand-residences.git

2. Install dependencies:
bashnpm install

3. Configure Firebase:
Update firebase.js with your Firebase project configuration.
Ensure Firestore rules are set in firestore.rules.

4. Deploy to Firebase Hosting:
bashfirebase deploy

## Screenshots
![Apartment Listings](screenshots/apartment-listings.png)
![Flat Detail Modal](screenshots/flat-detail-modal.png)

## Architecture
- **Frontend**: Built with HTML, CSS, and JavaScript, using a responsive design with modals and lightbox for image galleries.
- **Backend**: Firebase Firestore for apartment and testimonial data, Firebase Authentication for user management.
- **Hosting**: Firebase Hosting for deployment.
- **Server**: Express.js for potential API endpoints (though not fully implemented in provided code).

## File Structure

apartment.html: Main HTML file for the frontend
style.css: Styles for the application
script.js: Frontend logic with Firebase integration
firebase.js: Firebase SDK initialization
package.json: Project dependencies and scripts
firebase.json: Firebase hosting configuration
firestore.indexes.json: Firestore indexes configuration
.gitignore: Ignores unnecessary files (e.g., node_modules, logs)

## License
ISC License (see package.json)

## Contact
For inquiries, reach out to info@grandresidences.com.
