import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';




async function loadData() {
    const data = await d3.csv('meta/loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + (row.timezone || '+09:00')),
        datetime: new Date(row.datetime),
    }));
    console.log("Loaded data:", data); // 👈 이거 꼭 확인!
    console.log("Data length:", data.length);
    window.data = data;  // 또는 그냥 data = data; (암묵적 전역)

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
                url: 'https://github.com/SAMSOOSEO/lab-6/commit/' + commit,
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
     drawScatter(data, commits); 
})();




function drawScatter(data, commits) {
  const width = 800;
  const height = 400;
  const margin = { top: 10, right: 10, bottom: 50, left: 60 };
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
    .range([usableArea.bottom, usableArea.top]);

  const xScale = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([usableArea.left, usableArea.right]);

  // 그리드라인
  const gridlines = svg.append('g')
      .attr('class', 'gridlines')
      .attr('transform', `translate(${usableArea.left},0)`);

  gridlines.call(
      d3.axisLeft(yScale)
        .tickFormat('')
        .tickSize(-usableArea.width)
  ).selectAll('line')
    .attr('stroke', '#ccc')
    .attr('stroke-dasharray', '2,2');

  // X축
  svg.append('g')
      .attr('transform', `translate(0, ${usableArea.bottom})`)
      .call(d3.axisBottom(xScale)
        .ticks(d3.timeDay.every(1))
        .tickFormat(d3.timeFormat('%Y-%m-%d')))
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform", "rotate(-45)");

  // Y축
  svg.append('g')
      .attr('transform', `translate(${usableArea.left},0)`)
      .call(d3.axisLeft(yScale)
        .tickFormat(d => String(d % 24).padStart(2, '0') + ':00'));

        
  // 점 그리기 + tooltip 이벤트
svg.selectAll('circle')
  .data(commits)
  .join('circle')
  .attr('cx', d => xScale(d.date))
  .attr('cy', d => yScale(d.hourFrac))
  .attr('r', 5)
  .attr('fill', 'steelblue')
  .attr('opacity', 0.7)
  .on('mouseenter', (event, commit) => {
      renderTooltipContent(commit);    // 내용 업데이트
      updateTooltipVisibility(true);   // 툴팁 보여주기
      updateTooltipPosition(event);    // 마우스 위치로 이동
  })
  .on('mousemove', (event) => {
      updateTooltipPosition(event);    // 마우스 따라 이동
  })
  .on('mouseleave', () => {
      updateTooltipVisibility(false);  // 툴팁 숨기기
  });
}

// tooltip 내용 렌더링
function renderTooltipContent(commit) {
  if (!commit) return;

  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;

  document.getElementById('commit-date').textContent = commit.datetime?.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  document.getElementById('commit-time').textContent = commit.datetime?.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.pageX + 10}px`;
    tooltip.style.top = `${event.pageY + 10}px`;
}



/*Step 4: Communicating lines edited via dot size 부터 할차례임*/