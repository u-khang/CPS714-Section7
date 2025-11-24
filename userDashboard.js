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

// Fetch user's role from database using email
async function fetchUserRole(email) {
    try {
        const { data, error } = await supabaseClient
            .from(USERS_TABLE)
            .select("role")
            .eq("email", email)
            .maybeSingle();

        if (error) {
            console.error("Error fetching user role:", error);
            return null;
        }

        if (data) {
            return data.role || "Student";
        }

        return "Student";
    } catch (err) {
        console.error("Unexpected error fetching role:", err);
        return "Student";
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

// Display user's firstName, role, and event points on the dashboard
async function displayUserFirstName() {
    // Check for session first
    if (!checkSession()) {
        return;
    }

    // Get user email from sessionStorage
    const userDataStr = sessionStorage.getItem("userData");
    const userData = JSON.parse(userDataStr);
    const userEmail = userData.email;

    // Fetch firstName, role, and event points from database
    const [firstName, role, eventPoints] = await Promise.all([
        fetchUserFirstName(userEmail),
        fetchUserRole(userEmail),
        fetchUserEventPoints(userEmail)
    ]);

    // Display in userDetails div
    const userDetailsDiv = document.getElementById("userDetails");
    if (userDetailsDiv) {
        if (firstName) {
            userDetailsDiv.innerHTML = `<p><strong>User Name:</strong> ${firstName} | <strong>Role:</strong> ${role} | <strong>Total Event Points:</strong> ${eventPoints}</p>`;
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
            .select("id, status, event_id, point_claimed")
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


//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// EVENT RECOMMENDATIONS FUNCTIONS
// Fetch user's interested/attended events to get preferences
async function fetchUserInterestedOrAttendedEvents(userEmail) {
    try {
        // Fetch RSVPs with status "interested" or "attended"
        const { data: rsvps, error: rsvpError } = await supabaseClient
            .from(RSVPS_TABLE)
            .select("event_id")
            .eq("user_email", userEmail)
            .in("status", ["interested", "attended"]);

        if (rsvpError) {
            console.error("Error fetching user interested/attended RSVPs:", rsvpError);
            return [];
        }

        if (!rsvps || rsvps.length === 0) {
            return [];
        }

        // Get unique event IDs
        const eventIds = [...new Set(rsvps.map(r => r.event_id).filter(id => id !== null))];

        if (eventIds.length === 0) {
            return [];
        }

        // Fetch event details including organization and category
        const { data: events, error: eventsError } = await supabaseClient
            .from(EVENTS_TABLE)
            .select("id, \"hosting organization\", category")
            .in("id", eventIds);

        if (eventsError) {
            console.error("Error fetching events for recommendations:", eventsError);
            return [];
        }

        return events || [];
    } catch (err) {
        console.error("Unexpected error fetching user preferences:", err);
        return [];
    }
}

// Fetch recommended events based on user's interests
async function fetchRecommendedEvents(userEmail) {
    try {
        // Get user's interested/attended events to extract preferences
        const userEvents = await fetchUserInterestedOrAttendedEvents(userEmail);

        if (userEvents.length === 0) {
            // No preferences yet, return empty array
            return [];
        }

        // Extract unique organizations and categories
        const organizations = [...new Set(userEvents.map(e => e["hosting organization"]).filter(org => org !== null && org !== ""))];
        const categories = [...new Set(userEvents.map(e => e.category).filter(cat => cat !== null && cat !== ""))];

        if (organizations.length === 0 && categories.length === 0) {
            return [];
        }

        // Get current date for filtering future events
        const currentDate = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD

        // Fetch all future events, then filter by organization or category
        const { data: allFutureEvents, error: eventsError } = await supabaseClient
            .from(EVENTS_TABLE)
            .select("id, title, description, start_time, location, category, \"hosting organization\"")
            .gte("start_time", currentDate);

        if (eventsError) {
            console.error("Error fetching future events:", eventsError);
            return [];
        }

        if (!allFutureEvents || allFutureEvents.length === 0) {
            return [];
        }

        // Filter events that match organization OR category
        const recommendedEvents = allFutureEvents.filter(event => {
            const matchesOrg = organizations.length > 0 && 
                              event["hosting organization"] && 
                              organizations.includes(event["hosting organization"]);
            const matchesCat = categories.length > 0 && 
                              event.category && 
                              categories.includes(event.category);
            return matchesOrg || matchesCat;
        });

        // Remove duplicates and get user's existing RSVPs to exclude
        const { data: userRSVPs, error: rsvpError } = await supabaseClient
            .from(RSVPS_TABLE)
            .select("event_id")
            .eq("user_email", userEmail);

        const userRSVPIds = new Set();
        if (!rsvpError && userRSVPs) {
            userRSVPs.forEach(rsvp => {
                if (rsvp.event_id) {
                    userRSVPIds.add(rsvp.event_id);
                }
            });
        }

        // Remove duplicates and events user already RSVP'd to
        const uniqueEvents = [];
        const seenIds = new Set();
        
        recommendedEvents.forEach(event => {
            if (!seenIds.has(event.id) && !userRSVPIds.has(event.id)) {
                seenIds.add(event.id);
                uniqueEvents.push(event);
            }
        });

        return uniqueEvents;
    } catch (err) {
        console.error("Unexpected error fetching recommended events:", err);
        return [];
    }
}

// Display recommended events
function displayRecommendedEvents(events) {
    const container = document.getElementById("recommendedEvents");
    if (!container) return;

    if (events.length === 0) {
        container.innerHTML = '<p>No recommendations available at this time.</p>';
        return;
    }

    let html = '';
    events.forEach(event => {
        const title = event.title || 'Untitled Event';
        const description = event.description || '';
        const startTime = event.start_time ? new Date(event.start_time).toLocaleDateString() : 'TBD';
        const location = event.location || 'Location TBD';
        const category = event.category || 'Uncategorized';
        const organization = event["hosting organization"] || 'Unknown Organization';

        html += `
            <div class="event-card">
                <h3>${title}</h3>
                <p><strong>Organization:</strong> ${organization}</p>
                <p><strong>Category:</strong> ${category}</p>
                <p><strong>Date:</strong> ${startTime}</p>
                <p><strong>Location:</strong> ${location}</p>
                ${description ? `<p>${description}</p>` : ''}
            </div>
        `;
    });

    container.innerHTML = html;
}

// Load and display recommended events
async function loadRecommendedEvents() {
    // Check for session first
    if (!checkSession()) {
        return;
    }

    // Get user email from sessionStorage
    const userDataStr = sessionStorage.getItem("userData");
    const userData = JSON.parse(userDataStr);
    const userEmail = userData.email;

    // Fetch recommended events
    const recommendedEvents = await fetchRecommendedEvents(userEmail);
    
    // Display recommended events
    displayRecommendedEvents(recommendedEvents);
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
    
    // Load and display recommended events
    loadRecommendedEvents();
    
    // Load and display points and attended RSVPs
    loadPointsAndAttendedRSVPs();
});

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// ACHIEVEMENTS AND POINTS FUNCTIONS

// Fetch user's event_point
async function fetchUserEventPoints(userEmail) {
    try {
        const { data, error } = await supabaseClient
            .from(USERS_TABLE)
            .select("event_point")
            .eq("email", userEmail)
            .maybeSingle();

        if (error) {
            console.error("Error fetching user event points:", error);
            return 0;
        }

        return data?.event_point || 0;
    } catch (err) {
        console.error("Unexpected error fetching event points:", err);
        return 0;
    }
}

// Fetch attended RSVPs with event information
async function fetchAttendedRSVPs(userEmail) {
    try {
        // Fetch RSVPs with status "attended"
        const { data: rsvps, error: rsvpError } = await supabaseClient
            .from(RSVPS_TABLE)
            .select("id, status, event_id, point_claimed")
            .eq("user_email", userEmail)
            .eq("status", "attended");

        if (rsvpError) {
            console.error("Error fetching attended RSVPs:", rsvpError);
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
            console.error("Error fetching events for attended RSVPs:", eventsError);
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
        console.error("Unexpected error fetching attended RSVPs:", err);
        return [];
    }
}

// Display points and attended RSVPs
function displayPointsAndAttendedRSVPs(eventPoints, attendedRSVPs) {
    const achievementsList = document.getElementById("achievementsList");

    if (!achievementsList) return;

    // Display attended RSVPs
    if (attendedRSVPs.length === 0) {
        achievementsList.innerHTML = '<p>No attended events yet. Attend events to earn points!</p>';
        return;
    }

    let html = '';
    attendedRSVPs.forEach(rsvp => {
        const eventTitle = rsvp.event?.title || 'Unknown Event';
        const pointClaimed = rsvp.point_claimed === true;
        const canRedeem = !pointClaimed;

        html += `
            <div class="achievement-item">
                <div style="flex: 1;">
                    <strong>${eventTitle}</strong>
                    <p style="margin-top: 0.5rem; color: #6b7280; font-size: 0.9rem;">
                        ${pointClaimed ? 'Points already redeemed' : 'Earn 10 points for attending this event'}
                    </p>
                </div>
                <button 
                    class="redeem-button" 
                    data-rsvp-id="${rsvp.id}"
                    ${canRedeem ? '' : 'disabled'}
                >
                    ${pointClaimed ? 'Redeemed' : 'Redeem 10 Points'}
                </button>
            </div>
        `;
    });

    achievementsList.innerHTML = html;

    // Add event listeners to redeem buttons
    document.querySelectorAll('.redeem-button:not([disabled])').forEach(button => {
        button.addEventListener('click', async () => {
            const rsvpId = button.getAttribute('data-rsvp-id');
            await redeemPoints(rsvpId);
        });
    });
}

// Redeem points for an RSVP
async function redeemPoints(rsvpId) {
    // Check for session first
    if (!checkSession()) {
        return;
    }

    // Get user email from sessionStorage
    const userDataStr = sessionStorage.getItem("userData");
    const userData = JSON.parse(userDataStr);
    const userEmail = userData.email;

    // Convert rsvpId to number if it's a string
    const rsvpIdNum = typeof rsvpId === 'string' ? parseInt(rsvpId, 10) : rsvpId;

    try {
        // First, verify the RSVP belongs to the user and point_claimed is false
        const { data: rsvp, error: rsvpError } = await supabaseClient
            .from(RSVPS_TABLE)
            .select("id, point_claimed, user_email")
            .eq("id", rsvpIdNum)
            .eq("user_email", userEmail)
            .maybeSingle();

        if (rsvpError) {
            console.error("Error fetching RSVP:", rsvpError);
            alert("Error: Could not verify RSVP. Please try again.");
            return;
        }

        if (!rsvp) {
            alert("Error: RSVP not found.");
            return;
        }

        // Check if points are already claimed (handle null as false)
        if (rsvp.point_claimed === true) {
            alert("Points for this event have already been redeemed.");
            return;
        }

        // Get current event_point
        const { data: userData, error: userError } = await supabaseClient
            .from(USERS_TABLE)
            .select("event_point")
            .eq("email", userEmail)
            .maybeSingle();

        if (userError) {
            console.error("Error fetching user data:", userError);
            alert("Error: Could not fetch user data. Please try again.");
            return;
        }

        const currentPoints = userData?.event_point || 0;
        const newPoints = currentPoints + 10;

        // Update event_point and point_claimed in a transaction-like manner
        // First update the user's event_point
        const { error: updateUserError } = await supabaseClient
            .from(USERS_TABLE)
            .update({ event_point: newPoints })
            .eq("email", userEmail);

        if (updateUserError) {
            console.error("Error updating user points:", updateUserError);
            alert("Error: Could not update points. Please try again.");
            return;
        }

        // Then update the RSVP's point_claimed
        const { data: updateData, error: updateRsvpError } = await supabaseClient
            .from(RSVPS_TABLE)
            .update({ point_claimed: true })
            .eq("id", rsvpIdNum)
            .select();

        if (updateRsvpError) {
            console.error("Error updating RSVP:", updateRsvpError);
            // Try to rollback the points update
            await supabaseClient
                .from(USERS_TABLE)
                .update({ event_point: currentPoints })
                .eq("email", userEmail);
            alert("Error: Could not update RSVP. Please try again.");
            return;
        }

        // Check if the update actually affected any rows
        if (!updateData || updateData.length === 0) {
            console.error("No rows were updated for RSVP:", rsvpIdNum);
            // Try to rollback the points update
            await supabaseClient
                .from(USERS_TABLE)
                .update({ event_point: currentPoints })
                .eq("email", userEmail);
            alert("Error: Could not update RSVP. Please try again.");
            return;
        }

        console.log("Successfully updated RSVP:", updateData);

        // Success! Reload the points and attended RSVPs, and update user name display with new points
        await Promise.all([
            loadPointsAndAttendedRSVPs(),
            displayUserFirstName()
        ]);
        alert("Successfully redeemed points!");

    } catch (err) {
        console.error("Unexpected error redeeming points:", err);
        alert("An unexpected error occurred. Please try again.");
    }
}

// Load and display points and attended RSVPs
async function loadPointsAndAttendedRSVPs() {
    // Check for session first
    if (!checkSession()) {
        return;
    }

    // Get user email from sessionStorage
    const userDataStr = sessionStorage.getItem("userData");
    const userData = JSON.parse(userDataStr);
    const userEmail = userData.email;

    // Fetch points and attended RSVPs
    const [eventPoints, attendedRSVPs] = await Promise.all([
        fetchUserEventPoints(userEmail),
        fetchAttendedRSVPs(userEmail)
    ]);

    // Display points and attended RSVPs
    displayPointsAndAttendedRSVPs(eventPoints, attendedRSVPs);
}



