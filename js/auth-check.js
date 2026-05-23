(function() {
  const expectedHash = '43d6437edfcb3bf85a09fce326fb58dd07b013a80179527152d52fb45ade38c5'; // SHA-256 for 'RCPSC2026'
  if (sessionStorage.getItem('teacher_auth') !== expectedHash) {
    document.documentElement.style.display = 'none';
    window.location.replace('login.html');
  }
})();
