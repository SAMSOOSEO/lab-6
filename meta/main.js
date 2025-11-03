import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// CSV 로드 & 변환
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

// 커밋 처리
function processCommits(data) {
    return d3.groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;

            let ret = {
                id: commit,
                url: 'https://github.com/vis-society/lab-6/commit/' + commit,
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
                totalLines: lines.length,
            };

            Object.defineProperty(ret, 'lines', {
                value: lines,
                enumerable: false,
                writable: true,
                configurable: true
            });

            return ret;
        });
}

function renderCommitInfo(data, commits) {
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');

    // 통계 배열
const stats = [
    { label: 'Total LOC', value: data.length },  // 전체 행 수
    { label: 'Total commits', value: commits.length },  // 커밋 수
    { label: 'Number of files', value: d3.groups(data, d => d.file).length }, // distinct files
    {
        label: 'Longest file',
        value: (() => {
            const fileLengths = d3.rollups(
                data,
                v => v.length, // 각 파일의 행 수
                d => d.file
            );
            const maxFile = d3.greatest(fileLengths, d => d[1]);
            return maxFile[1]; // 숫자만 반환
        })()
    },
    { label: 'Maximum depth', value: d3.max(data, d => d.depth) }, // 최대 depth
    { label: 'Longest line', value: d3.max(data, d => d.length) }, // 가장 긴 line
    { label: 'Average line length', value: d3.mean(data, d => d.length).toFixed(1) }, // 평균 line 길이
];


    // 카드 생성
    const cards = dl.selectAll('div.stat-card')
        .data(stats)
        .join('div')
        .attr('class', 'stat-card');

    cards.append('dt').text(d => d.label);
    cards.append('dd').text(d => d.value);
}

(async function () {
    const data = await loadData();
    const commits = processCommits(data);
    renderCommitInfo(data, commits);
     drawScatter(data); 
})();


function drawScatter(data) {
  const width = 800;
  const height = 400;

  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart')
    .append('svg')
    .attr('width', width)
    .attr('height', height);

  // 스케일

  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]); // y 축은 위쪽이 0

  // X축
const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date)) // datetime 대신 date 사용
    .range([usableArea.left, usableArea.right]);

// X축
const xAxis = d3.axisBottom(xScale)
    .ticks(d3.timeDay.every(1)) // 하루 단위 눈금
    .tickFormat(d3.timeFormat('%Y-%m-%d')); // YYYY-MM-DD 포맷

svg.append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end");

  // Y축
  const yAxis = d3.axisLeft(yScale);
  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(yAxis);

  // 점 그리기
  svg.selectAll('circle')
    .data(data)
    .join('circle')
    .attr('cx', d => xScale(d.datetime))
    .attr('cy', d => yScale(d.datetime.getHours() + d.datetime.getMinutes()/60))
    .attr('r', 3)
    .attr('fill', 'steelblue')
    .attr('opacity', 0.7);
}