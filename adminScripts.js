const ROLE_OPTIONS = [
  "Student",
  "Department Admin",
  "Club Leader",
  "System Administrator"
];


function createRoleSelect(currentRole, onChange) {
  const select = document.createElement('select');
  select.style.padding = '6px';
  select.style.borderRadius = '6px';
  select.style.border = '1px solid #d1d5db';
  ROLE_OPTIONS.forEach(role => {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    if (role === currentRole) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener('change', () => onChange(select.value, select));
  return select;
}
// Update table with users from supabase table users
async function loadUsers() {
  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = '<tr><td colspan="5" class="small-muted">Loading users…</td></tr>';
  try {
    const { data, error } = await supabaseClient
      .from('users')
      .select('id,firstName,lastName,email,role')
      .order('id', { ascending: true });

    if (!data || data.length === 0) { // if no users in db
      tbody.innerHTML = '<tr><td colspan="5" class="small-muted">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';
    data.forEach(user => { //iterate through all data from supabase users 
      const tr = document.createElement('tr');

      // ID
      const idTd = document.createElement('td');
      idTd.textContent = user.id ?? '';
      tr.appendChild(idTd);

      // Full name
      const nameTd = document.createElement('td');
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ');
      nameTd.textContent = fullName || '—';
      tr.appendChild(nameTd);

      // Email
      const emailTd = document.createElement('td');
      emailTd.textContent = user.email || '—';
      tr.appendChild(emailTd);

      // Role dropdown for selection
      const roleTd = document.createElement('td');
      const currentRole = user.role || 'Student';
      const select = createRoleSelect(currentRole, (newRole, selectEl) => updateUserRole(user.id, newRole, selectEl, statusTd));
      roleTd.appendChild(select);
      tr.appendChild(roleTd);

      // Status
      const statusTd = document.createElement('td');
      statusTd.className = 'status small-muted';
      statusTd.textContent = '';
      tr.appendChild(statusTd);

      tbody.appendChild(tr);
    });

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="small-muted">Unexpected error: ${err.message}</td></tr>`;
  }
}

async function updateUserRole(userId, newRole, selectEl, statusTd) {
  if (!confirm(`Change role for user ID ${userId} to "${newRole}"?`)) {
    await loadUsers();
    return;
  }

  selectEl.disabled = true;
  statusTd.textContent = 'Saving...';

  try {
    const { data, error } = await supabaseClient
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .maybeSingle();

    if (error) {
      statusTd.textContent = 'Save failed';
      console.error('Update role error', error);
      selectEl.disabled = false;
      return;
    }

    statusTd.textContent = 'Saved';
    setTimeout(() => { statusTd.textContent = ''; }, 1500);

  } catch (err) {
    statusTd.textContent = 'Error';
    console.error('Unexpected update error', err);
  } finally {
    selectEl.disabled = false;
  }
}

// buttons once console.html loaded
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('refreshBtn').addEventListener('click', loadUsers); //load user list from supabase
  document.getElementById('reloadPage').addEventListener('click', () => location.reload());

  if (typeof supabaseClient === 'undefined') {
    const waitForClient = setInterval(() => {
      if (typeof supabaseClient !== 'undefined') {
        clearInterval(waitForClient);
        loadUsers();
      }
    }, 50);
    setTimeout(() => clearInterval(waitForClient), 5000);
  } else {
    loadUsers();
  }
});