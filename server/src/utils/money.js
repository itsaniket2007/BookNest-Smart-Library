function roundMoney(amount) {
  return Math.round(Number(amount || 0) * 100) / 100;
}

function monthKey(date) {
  const d = date ? new Date(date) : new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function publicUser(user) {
  if (!user) return null;
  const photoUrl = user.photoFilename ? "/api/users/me/photo-file" : "";
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile || "",
    address: user.address || "",
    category: user.favoriteCategory || "",
    role: user.role,
    monthlyReadingTarget: user.monthlyReadingTarget,
    photoUrl: photoUrl,
    isEmailVerified: user.isEmailVerified || false,
    createdAt: user.createdAt
  };
}

module.exports = { roundMoney, monthKey, publicUser };
