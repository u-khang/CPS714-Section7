// Decode Google JSON web token
function decodeJWT(token) {
    let base64Url = token.split(".")[1];
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    let jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(jsonPayload);
}

// Runs after Google sign-in successful
async function onSignIn(response) {
    
    console.log("Google JWT response:", decodeJWT(response.credential));

    const userData = decodeJWT(response.credential); // Decode JWT

    // Check if  email ends with @torontomu.ca
    if (userData.email.endsWith("@torontomu.ca")) {
      
        //Show website content on successful login
        document.getElementById("mainContent").style.display = "block";
        document.getElementById("landingContainer").style.display = "none";


        
        // Store both credential and user data
        sessionStorage.setItem("credential", response.credential);
        sessionStorage.setItem("userData", JSON.stringify(userData));


        // Check if user exists in Supabase and store role in sessionStorage
        try {
            const result = await checkIfUserExists(userData.email);
            let userRole = "Student"; // Set a default role

            if (result.exists && result.data) {
                // User was found
                console.log("User role:", result.data.role);
                userRole = result.data.role || "Student"; // Use found role, default student otherwise
            
            } else { // User not found, make new user
                const newUser = await createUserInDB(userData.given_name, userData.family_name, userData.email, "Student");
                
                if (newUser) {
                    console.log("User created. Role:", newUser.role);
                    userRole = newUser.role; 
                } else {
                    console.error("Failed to create new user in database.");
                }
            }
            
            // Store created role in sessionStorage
            sessionStorage.setItem("role", userRole);

        } catch (err) {
            console.error("Error during user check/creation:", err);
            // Fallback role
            sessionStorage.setItem("role", "Student");
        }

        if (sessionStorage.getItem("role") == "System Administrator") {
            const userInfoDiv = document.getElementById("userInfo");
            userInfoDiv.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <a href="/console.html" style="text-decoration:none;color:inherit;">
                <span>Admin Console</span>
                </a>
            </div>
            `;
        }

    } else {
        alert("Access restricted to @torontomu.ca email addresses.");
    }
}

// Fetch user data from cookies for profile page


// Initialize Supabase client
const SUPABASE_URL = "https://mtjgmoctyzgfubkpsydg.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10amdtb2N0eXpnZnVia3BzeWRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2Mjc5MTksImV4cCI6MjA3NTIwMzkxOX0.9Ku1_VjUhsBUtHwPSiBCYAez8sWyhK0x6Hc2SVxpqnk";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("Supabase object:", supabaseClient);

// Check if the user exists in the database
async function checkIfUserExists(email) {
    try {
        const { data, error } = await supabaseClient
            .from("users")
            .select("*")
            .eq("email", email)
            .maybeSingle();

        if (error) {
            console.error("Database Error", error);
            return { exists: false, error, data: null };
        }
        
        if (data) {
            console.log("User data fetched:", data);
            return { exists: true, data: data };
        } 
        
        console.log("User not found in DB.");
        return { exists: false, data: null };

    } catch (err) {
        console.error("Unexpected error", err);
        return { exists: false, error: err, data: null };
    }
}
// Create a new user record in the users table
async function createUserInDB(firstName, lastName, email, role) {
    try {
        const { data, error } = await supabaseClient
            .from("users")
            .insert([{firstName, lastName, email, role }])
            .select()
            .maybeSingle();

        if (error) {
            console.error("Error creating user:", error);
            return null;
        }

        return data; // inserted record
    } catch (err) {
        console.error("Unexpected error creating user:", err);
        return null;
    }
}

// Check if user already has an active session and initialize page so dont have to log in again
function initializeSession() {
    const credential = sessionStorage.getItem("credential");
    const userData = sessionStorage.getItem("userData");

    if (credential && userData) {
        document.getElementById("mainContent").style.display = "block";
        document.getElementById("landingContainer").style.display = "none";

        if (sessionStorage.getItem("role") == "System Administrator") {
            const userInfoDiv = document.getElementById("userInfo");
            userInfoDiv.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <a href="/console.html" style="text-decoration:none;color:inherit;">
                <span>Admin Console</span>
                </a>
            </div>
            `;
        }
    }
}

// Call on page load
window.addEventListener("DOMContentLoaded", () => {
  initializeSession();
  //check permissions for creating events
  const createEventsLink = document.getElementById("createEventsLink");
  if (createEventsLink) {
    createEventsLink.addEventListener("click", function(e) {
      const role = sessionStorage.getItem("role");
      // Only allow Department Admin, Club Leader, or System Administrator
      if (!["Department Admin", "Club Leader", "System Administrator"].includes(role)) {
        e.preventDefault();
        alert("You do not have permission to create events.");
      }
    });
  }
});