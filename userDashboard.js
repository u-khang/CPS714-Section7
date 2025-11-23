// Initialize Supabase client (copied from scripts.js)
const SUPABASE_URL = "https://mtjgmoctyzgfubkpsydg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10amdtb2N0eXpnZnVia3BzeWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2Mjc5MTksImV4cCI6MjA3NTIwMzkxOX0.9Ku1_VjUhsBUtHwPSiBCYAez8sWyhK0x6Hc2SVxpqnk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Table names
const USERS_TABLE = "users";
const EVENTS_TABLE = "team4_events";
const RSVPS_TABLE = "team4_rsvps";

// Fetch user's firstName from database using email
async function fetchUserFirstName(email) {
    try {
        const { data, error } = await supabaseClient
            .from(USERS_TABLE)
            .select("firstName")
            .eq("email", email)
            .maybeSingle();

        if (error) {
            console.error("Error fetching user firstName:", error);
            return null;
        }

        if (data) {
            return data.firstName;
        }

        return null;
    } catch (err) {
        console.error("Unexpected error fetching firstName:", err);
        return null;
    }
}

// Check if user has an active session
function checkSession() {
    const credential = sessionStorage.getItem("credential");
    const userDataStr = sessionStorage.getItem("userData");
    
    // If no session data, redirect to index.html to sign in
    if (!credential || !userDataStr) {
        console.log("No session found, redirecting to index.html");
        window.location.href = "index.html";
        return false;
    }
    
    return true;
}

// Display user's firstName on the dashboard
async function displayUserFirstName() {
    // Check for session first
    if (!checkSession()) {
        return;
    }

    // Get user email from sessionStorage
    const userDataStr = sessionStorage.getItem("userData");
    const userData = JSON.parse(userDataStr);
    const userEmail = userData.email;

    // Fetch firstName from database
    const firstName = await fetchUserFirstName(userEmail);

    // Display in userDetails div
    const userDetailsDiv = document.getElementById("userDetails");
    if (userDetailsDiv) {
        if (firstName) {
            userDetailsDiv.innerHTML = `<p><strong>Name:</strong> ${firstName}</p>`;
        } else {
            userDetailsDiv.innerHTML = `<p>Unable to load user information.</p>`;
        }
    }
}

// Fetch user's RSVPs with event information
async function fetchUserRSVPs(userEmail) {
    try {
        // First, fetch all RSVPs for the user
        const { data: rsvps, error: rsvpError } = await supabaseClient
            .from(RSVPS_TABLE)
            .select("id, status, event_id")
            .eq("user_email", userEmail);

        if (rsvpError) {
            console.error("Error fetching user RSVPs:", rsvpError);
            return [];
        }

        if (!rsvps || rsvps.length === 0) {
            return [];
        }

        // Get unique event IDs
        const eventIds = [...new Set(rsvps.map(r => r.event_id).filter(id => id !== null))];

        if (eventIds.length === 0) {
            return rsvps.map(r => ({ ...r, event: null }));
        }

        // Fetch event details
        const { data: events, error: eventsError } = await supabaseClient
            .from(EVENTS_TABLE)
            .select("id, title")
            .in("id", eventIds);

        if (eventsError) {
            console.error("Error fetching events:", eventsError);
            // Return RSVPs without event details
            return rsvps.map(r => ({ ...r, event: null }));
        }

        // Create a map of event_id to event
        const eventMap = {};
        if (events) {
            events.forEach(event => {
                eventMap[event.id] = event;
            });
        }

        // Combine RSVPs with event information
        return rsvps.map(rsvp => ({
            ...rsvp,
            event: eventMap[rsvp.event_id] || null
        }));

    } catch (err) {
        console.error("Unexpected error fetching RSVPs:", err);
        return [];
    }
}

// Display RSVPs in the table
function displayRSVPsInTable(rsvps) {
    const tableBody = document.getElementById("eventsTableBody");
    if (!tableBody) return;

    if (rsvps.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="2">No events found.</td></tr>';
        return;
    }

    let html = '';
    rsvps.forEach(rsvp => {
        const eventTitle = rsvp.event?.title || 'Unknown Event';
        const status = rsvp.status || 'unknown';
        html += `
            <tr>
                <td>${eventTitle}</td>
                <td>${status}</td>
            </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Load and display user's RSVPs
async function loadUserRSVPs() {
    // Check for session first
    if (!checkSession()) {
        return;
    }

    // Get user email from sessionStorage
    const userDataStr = sessionStorage.getItem("userData");
    const userData = JSON.parse(userDataStr);
    const userEmail = userData.email;

    // Fetch RSVPs
    const rsvps = await fetchUserRSVPs(userEmail);
    
    // Display RSVPs in table
    displayRSVPsInTable(rsvps);
}

// Initialize on page load
window.addEventListener("DOMContentLoaded", () => {
    // Ensure mainContent is visible (in case it was hidden)
    const mainContent = document.getElementById("mainContent");
    if (mainContent) {
        mainContent.style.display = "block";
    }
    
    // Check session and display user data
    displayUserFirstName();
    
    // Load and display user's RSVPs
    loadUserRSVPs();
});

