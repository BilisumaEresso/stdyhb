function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchAlias(text, alias) {
  const r = new RegExp('(^|\\W)' + escapeRegExp(alias) + '($|\\W)', 'i');
  return r.test(text);
}

console.log('dbms in dbms exam:', matchAlias('dbms exam', 'dbms'));
console.log('c++ in c++ ppt:', matchAlias('c++ ppt', 'c++'));
console.log('c in calculus:', matchAlias('calculus', 'c'));
console.log('c in c programming:', matchAlias('c programming', 'c'));
console.log('math 1 in math 1 final:', matchAlias('math 1 final', 'math 1'));
console.log('mathematics for natural sciences in query:', matchAlias('mathematics for natural sciences', 'mathematics for natural sciences'));
