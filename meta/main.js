import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// CSV 파일 읽기 + 숫자/날짜 변환
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// 커밋 데이터 처리 함수
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      return {
        id: commit,
        author: first.author,
        date: first.date,
        timezone: first.timezone,
        lines: lines.length, // 해당 커밋에서 수정된 줄 수
      };
    });
}

// 실행 부분
let data = await loadData();   // loc.csv 불러오기
let commits = processCommits(data);  // 커밋 단위로 정리

console.log(commits);  // 결과 확인
