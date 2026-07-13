(function () {
  const expectedHash =
    "43d6437edfcb3bf85a09fce326fb58dd07b013a80179527152d52fb45ade38c5"; // SHA-256 for 'RCPSC2026'
  const authKey = "teacher_auth";
  const expiryKey = "teacher_auth_expires";
  const storedHash = localStorage.getItem(authKey);
  const expiryTime = Number(localStorage.getItem(expiryKey) || 0);

  if (
    !storedHash ||
    storedHash !== expectedHash ||
    !expiryTime ||
    Date.now() > expiryTime
  ) {
    localStorage.removeItem(authKey);
    localStorage.removeItem(expiryKey);
    document.documentElement.style.display = "none";
    window.location.replace("login.html");
  }
})();
