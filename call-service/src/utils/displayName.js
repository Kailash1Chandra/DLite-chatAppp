function getDisplayName(user) {
  const meta = user && typeof user === "object" ? user.user_metadata || {} : {}
  const username = String(meta.username || "").trim()
  if (username) return username
  const fullName = String(meta.full_name || "").trim()
  if (fullName) return fullName
  const email = String((user && user.email) || "").trim()
  if (email && email.includes("@")) return email.split("@")[0] || "User"
  return "User"
}

module.exports = { getDisplayName }

