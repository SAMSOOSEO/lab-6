import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';




async function loadData() {
   const data = await d3.csv('loc.csv', (row) => ({
        ...row,
        line: Number(row.line),
        depth: Number(row.depth),
        length: Number(row.length),
        date: new Date(row.date + 'T00:00' + (row.timezone || '+09:00')),
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

  // X, Y 스케일
  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  const xExtent = d3.extent(data, d => d.date);
  const xScale = d3.scaleTime()
    .domain([d3.timeDay.offset(xExtent[0], -1), d3.timeDay.offset(xExtent[1], 1)])
    .range([usableArea.left, usableArea.right]);

  // 점 크기 스케일
  const [minLines, maxLines] = d3.extent(commits, d => d.totalLines);
  const rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  const sortedCommits = d3.sort(commits, d => -d.totalLines); // 큰 점이 뒤쪽으로

  // 그리드라인
  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width))
    .selectAll('line')
    .attr('stroke', '#ccc')
    .attr('stroke-dasharray', '2,2');

  // X축
  svg.append('g')
    .attr('transform', `translate(0,${usableArea.bottom})`)
    .call(d3.axisBottom(xScale).ticks(d3.timeDay.every(1)).tickFormat(d3.timeFormat('%Y-%m-%d')))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-45)");

  // Y축
  svg.append('g')
    .attr('transform', `translate(${usableArea.left},0)`)
    .call(d3.axisLeft(yScale).tickFormat(d => String(d % 24).padStart(2, '0') + ':00'));

  // 1️⃣ 산점도 점
  const dots = svg.append('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', d => xScale(d.date))
    .attr('cy', d => yScale(d.hourFrac))
    .attr('r', d => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => updateTooltipPosition(event))
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // 2️⃣ 브러시
  const brush = d3.brush()
    .extent([[usableArea.left, usableArea.top], [usableArea.right, usableArea.bottom]])
    .on("brush end", (event) => {
      // 선택된 영역 좌표
      const selection = event.selection;
      if (!selection) return;
      const [[x0, y0], [x1, y1]] = selection;

      // 영역 안에 있는 점만 필터링 (선택)
      dots.attr('stroke', d =>
        xScale(d.date) >= x0 && xScale(d.date) <= x1 && yScale(d.hourFrac) >= y0 && yScale(d.hourFrac) <= y1
          ? 'orange' : null
      );
    });

  svg.append("g")
    .attr("class", "brush")
    .call(brush);

  // 3️⃣ 브러시 overlay 때문에 tooltip 사라지는 문제 해결
  svg.selectAll('.dots, .overlay ~ *').raise();
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
function isCommitSelected(selection, commit, xScale, yScale) {
  if (!selection) return false;

  const [[x0, y0], [x1, y1]] = selection;
  const cx = xScale(commit.date);
  const cy = yScale(commit.hourFrac); 

  return x0 <= cx && cx <= x1 && y0 <= cy && cy <= y1;
}

function brushed(event, xScale, yScale) {
  const selection = event.selection;

  d3.selectAll('circle')
    .classed('selected', d => isCommitSelected(selection, d, xScale, yScale));
}

const brush = d3.brush()
  .extent([[usableArea.left, usableArea.top], [usableArea.right, usableArea.bottom]])
  .on('start brush end', (event) => brushed(event, xScale, yScale));

svg.append('g')
  .attr('class', 'brush')
  .call(brush);

// 브러시 뒤쪽 점이 안 가려지도록
svg.selectAll('circle').raise();

