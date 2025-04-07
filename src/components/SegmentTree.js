import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const MAX = 1000;
let tree = new Array(MAX).fill(0);
let lazy = new Array(MAX).fill(0);

function constructSTUtil(arr, ss, se, si, nodes, parent = null, steps = [], highlight = []) {
  if (ss > se) return;
  const node = {
    id: si,
    name: `[${ss}:${se}] = ?`,
    parent,
    range: [ss, se],
    value: null,
    status: 'initial',
  };
  nodes.push(node);
  steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight] });
  if (ss === se) {
    node.value = arr[ss];
    node.name = `[${ss}] = ${arr[ss]}`;
    node.status = 'completed';
    tree[si] = arr[ss];
    steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [] });
    return;
  }
  node.status = 'calculating';
  steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight] });
  const mid = Math.floor((ss + se) / 2);
  const leftChildIndex = si * 2 + 1;
  const rightChildIndex = si * 2 + 2;
  constructSTUtil(arr, ss, mid, leftChildIndex, nodes, si, steps, [...highlight, leftChildIndex]);
  constructSTUtil(arr, mid + 1, se, rightChildIndex, nodes, si, steps, [...highlight, rightChildIndex]);
  const leftNode = nodes.find(n => n.id === leftChildIndex);
  const rightNode = nodes.find(n => n.id === rightChildIndex);
  if (leftNode && rightNode && leftNode.status === 'completed' && rightNode.status === 'completed') {
    tree[si] = leftNode.value + rightNode.value;
    node.value = tree[si];
    node.name = `[${ss}:${se}] = ${tree[si]}`;
    node.status = 'completed';
    highlight = highlight.filter(h => h !== leftChildIndex && h !== rightChildIndex);
    steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight, si] });
  } else {
    steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight] });
  }
}

function constructST(arr, n, nodes, steps) {
  tree.fill(0);
  nodes.length = 0;
  steps.length = 0;
  constructSTUtil(arr, 0, n - 1, 0, nodes, null, steps, [0]);
}

function buildHierarchy(nodes) {
  const nodeMap = new Map();
  nodes.forEach((node) => {
    node.children = [];
    nodeMap.set(node.id, node);
  });
  const root = nodeMap.get(0);
  nodes.forEach((node) => {
    if (node.parent !== null && nodeMap.has(node.parent)) {
      nodeMap.get(node.parent).children.push(node);
    }
  });
  return root;
}

function querySTUtil(si, ss, se, qs, qe, highlightSteps, currentSum, queryPath, visitedNodes) {
  const currentHighlight = si !== null ? [...queryPath, si] : [...queryPath];
  const shouldHighlight = si !== null && !(se < qs || ss > qe);
  if (shouldHighlight) {
    highlightSteps.push({ highlight: currentHighlight.filter(val => val !== null), visited: Array.from(visitedNodes) });
  } else if (si !== null) {
    highlightSteps.push({ highlight: [], visited: Array.from(visitedNodes) });
  }
  if (ss > qe || se < qs) {
    visitedNodes.add(si);
    return 0;
  }
  if (qs <= ss && se <= qe) {
    visitedNodes.add(si);
    return tree[si];
  }
  const mid = Math.floor((ss + se) / 2);
  visitedNodes.add(si);
  const leftSum = querySTUtil(si * 2 + 1, ss, mid, qs, qe, highlightSteps, currentSum, currentHighlight, new Set([...visitedNodes]));
  const rightSum = querySTUtil(si * 2 + 2, mid + 1, se, qs, qe, highlightSteps, currentSum, currentHighlight, new Set([...visitedNodes]));
  return leftSum + rightSum;
}

function updateSTUtil(si, ss, se, i, diff, updateSteps, updatePath, visitedNodes) {
  const currentHighlight = si !== null ? [...updatePath, si] : [...updatePath];
  const shouldHighlight = si !== null && (i >= ss && i <= se);
  if (shouldHighlight) {
    updateSteps.push({ highlight: currentHighlight.filter(val => val !== null), visited: Array.from(visitedNodes) });
  } else if (si !== null) {
    updateSteps.push({ highlight: [], visited: Array.from(visitedNodes) });
  }

  if (i < ss || i > se) {
    visitedNodes.add(si);
    return;
  }

  visitedNodes.add(si);
  tree[si] = tree[si] + diff;

  if (ss !== se) {
    const mid = Math.floor((ss + se) / 2);
    updateSTUtil(si * 2 + 1, ss, mid, i, diff, updateSteps, currentHighlight, new Set([...visitedNodes]));
    updateSTUtil(si * 2 + 2, mid + 1, se, i, diff, updateSteps, currentHighlight, new Set([...visitedNodes]));
  }
}

const SegmentTreeD3 = () => {
  const [locations, setLocations] = useState([]);
  const [name, setName] = useState('');
  const [population, setPopulation] = useState('');
  const [treeBuilt, setTreeBuilt] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [steps, setSteps] = useState([]);
  const [constructing, setConstructing] = useState(false);
  const [currentConstructStep, setCurrentConstructStep] = useState(0);
  const [animationTimeoutId, setAnimationTimeoutId] = useState(null);
  const [constructionDelay] = useState(500);

  const svgRef = useRef();
  const queryStartRef = useRef(null);
  const queryEndRef = useRef(null);
  const [queryResult, setQueryResult] = useState(null);
  const [querySteps, setQuerySteps] = useState([]);
  const [currentQueryStep, setCurrentQueryStep] = useState(0);
  const [isQuerying, setIsQuerying] = useState(false);
  const [queryAnimationTimeoutId, setQueryAnimationTimeoutId] = useState(null);
  const [queryAnimationDelay] = useState(800);

  const [updateIndex, setUpdateIndex] = useState('');
  const [updateValue, setUpdateValue] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSteps, setUpdateSteps] = useState([]);
  const [currentUpdateStep, setCurrentUpdateStep] = useState(0);
  const [updateAnimationTimeoutId, setUpdateAnimationTimeoutId] = useState(null);
  const [updateAnimationDelay] = useState(1500);

  const handleAdd = () => {
    if (name && !isNaN(population)) {
      setLocations([...locations, { name, population: Number(population) }]);
      setName('');
      setPopulation('');
      setTreeBuilt(false);
      setNodes([]);
      setSteps([]);
      setQueryResult(null);
      setQuerySteps([]);
      setCurrentQueryStep(0);
      setIsQuerying(false);
      setConstructing(false);
      setCurrentConstructStep(0);
      if (animationTimeoutId) clearTimeout(animationTimeoutId);
      if (queryAnimationTimeoutId) clearTimeout(queryAnimationTimeoutId);
      setIsUpdating(false);
      setUpdateSteps([]);
      setCurrentUpdateStep(0);
      if (updateAnimationTimeoutId) clearTimeout(updateAnimationTimeoutId);
    }
  };

  const handleBuildTree = () => {
    if (locations.length === 0) return;
    setTreeBuilt(false);
    setNodes([]);
    setSteps([]);
    setCurrentConstructStep(0);
    setConstructing(true);
    if (animationTimeoutId) clearTimeout(animationTimeoutId);
    const arr = locations.map((loc) => loc.population);
    const newNodes = [];
    const newSteps = [];
    constructST(arr, arr.length, newNodes, newSteps);
    setNodes(newNodes);
    setSteps(newSteps);
  };

  const getNodeName = (id) => {
    const node = nodes.find(n => n.id === id);
    return node ? node.name : `ID ${id}`;
  };

  useEffect(() => {
    if (constructing && currentConstructStep < steps.length) {
      const nextNodes = steps[currentConstructStep].nodes;
      const timeoutId = setTimeout(() => {
        setNodes(nextNodes);
        setCurrentConstructStep(prev => prev + 1);
      }, constructionDelay);
      setAnimationTimeoutId(timeoutId);
    } else if (constructing && currentConstructStep === steps.length) {
      setConstructing(false);
      setTreeBuilt(true);
    }
    return () => clearTimeout(animationTimeoutId);
  }, [constructing, currentConstructStep, steps, constructionDelay]);

  const handleQuery = () => {
    if (!treeBuilt || locations.length === 0) {
      alert('Vui lòng xây dựng cây trước khi truy vấn.');
      return;
    }
    const start = parseInt(queryStartRef.current.value);
    const end = parseInt(queryEndRef.current.value);

    if (isNaN(start) || isNaN(end) || start < 0 || end >= locations.length || start > end) {
      alert('Vui lòng nhập chỉ số truy vấn hợp lệ.');
      return;
    }

    setQueryResult(null);
    setQuerySteps([]);
    setCurrentQueryStep(0);
    setIsQuerying(true);
  };

  useEffect(() => {
    if (isQuerying && querySteps.length > 0 && currentQueryStep < querySteps.length) {
      const timeoutId = setTimeout(() => {
        setCurrentQueryStep(prev => prev + 1);
      }, queryAnimationDelay);
      setQueryAnimationTimeoutId(timeoutId);
    } else if (isQuerying && currentQueryStep === querySteps.length && queryResult === null) {
      const start = parseInt(queryStartRef.current.value);
      const end = parseInt(queryEndRef.current.value);
      const highlightSteps = [];
      const visitedNodes = new Set();
      const result = querySTUtil(0, 0, locations.length - 1, start, end, highlightSteps, 0, [], visitedNodes);
      setQueryResult(result);
      setQuerySteps(highlightSteps);
      setCurrentQueryStep(0);
    } else if (isQuerying && currentQueryStep === querySteps.length && queryResult !== null) {
      setIsQuerying(false);
    }
    return () => clearTimeout(queryAnimationTimeoutId);
  }, [isQuerying, querySteps, currentQueryStep, queryResult, locations.length, queryAnimationDelay]);

  const handleUpdate = () => {
    if (!treeBuilt || locations.length === 0) {
      alert('Vui lòng xây dựng cây trước khi cập nhật.');
      return;
    }
    const index = parseInt(updateIndex);
    const value = parseInt(updateValue);

    if (isNaN(index) || isNaN(value) || index < 0 || index >= locations.length) {
      alert('Vui lòng nhập chỉ số và giá trị cập nhật hợp lệ.');
      return;
    }

    setIsUpdating(true);
    setUpdateSteps([]);
    setCurrentUpdateStep(0);
    const originalValue = locations[index].population;
    const diff = value - originalValue;
    const newLocations = locations.map((loc, i) =>
      i === index ? { ...loc, population: value } : loc
    );
    setLocations(newLocations);

    const highlightSteps = [];
    const visitedNodes = new Set();
    updateSTUtil(0, 0, locations.length - 1, index, diff, highlightSteps, [], visitedNodes);
    setUpdateSteps(highlightSteps);

    // Cập nhật state nodes để re-render cây với giá trị mới
    const updatedNodes = nodes.map(node => {
      if (node.range && node.range[0] <= index && node.range[1] >= index) {
        if (node.range[0] === node.range[1] && node.range[0] === index) {
          return { ...node, value: value, name: `[${index}] = ${value}` };
        } else if (node.status === 'completed') {
          // Cập nhật các node tổng dựa trên locations mới
          let newValue = 0;
          const [start, end] = node.range;
          for (let i = start; i <= end; i++) {
            newValue += newLocations[i].population;
          }
          return { ...node, value: newValue, name: `[${start}:${end}] = ${newValue}` };
        }
      }
      return node;
    });
    setNodes(updatedNodes);
  };

  useEffect(() => {
    if (isUpdating && updateSteps.length > 0 && currentUpdateStep < updateSteps.length) {
      const timeoutId = setTimeout(() => {
        setCurrentUpdateStep(prev => prev + 1);
      }, updateAnimationDelay);
      setUpdateAnimationTimeoutId(timeoutId);
    } else if (isUpdating && currentUpdateStep === updateSteps.length) {
      setIsUpdating(false);
    }
    return () => clearTimeout(updateAnimationTimeoutId);
  }, [isUpdating, updateSteps, currentUpdateStep, updateAnimationDelay]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const width = 700;
    const height = 500;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const rootData = buildHierarchy(nodes);
    const hierarchy = d3.hierarchy(rootData);
    const treeLayout = d3.tree().size([width - 100, height - 150]);
    const treeData = treeLayout(hierarchy);

    svg.selectAll('line')
      .data(treeData.links())
      .enter()
      .append('line')
      .attr('x1', d => d.source.x + 30)
      .attr('y1', d => d.source.y + 30)
      .attr('x2', d => d.target.x + 30)
      .attr('y2', d => d.target.y + 30)
      .attr('stroke', 'gray');

    const nodeGroup = svg.selectAll('g')
      .data(treeData.descendants())
      .enter()
      .append('g')
      .attr('transform', d => `translate(${d.x + 30}, ${d.y + 30})`);

    nodeGroup.append('circle')
      .attr('r', 20)
      .attr('fill', d => {
        if (constructing) {
          if (d.data.status === 'completed') return '#ff9800';
          if (d.data.status === 'calculating') return '#f44336';
        } else if (isQuerying && querySteps.length > 0 && currentQueryStep > 0) {
          const currentStepData = querySteps[currentQueryStep - 1];
          if (currentStepData?.highlight.includes(d.data.id)) return 'darkorange';
          if (currentStepData?.visited.includes(d.data.id)) return '#add8e6';
        } else if (isUpdating && updateSteps.length > 0 && currentUpdateStep > 0) {
          const currentStepData = updateSteps[currentUpdateStep - 1];
          if (currentStepData?.highlight.includes(d.data.id)) return 'lightgreen';
          if (currentStepData?.visited.includes(d.data.id)) return '#d3d3d3';
        }
        return '#f0f0f0';
      })
      .attr('stroke', 'black')
      .attr('stroke-width', 1);

    nodeGroup.append('text')
      .attr('dy', 5)
      .attr('x', 0)
      .attr('text-anchor', 'middle')
      .style('font-size', '10px')
      .text(d => d.data.name);

    if (constructing && currentConstructStep > 0 && steps[currentConstructStep - 1]?.highlight.length > 0) {
      const highlightedNodes = steps[currentConstructStep - 1].highlight.flat();
      svg.selectAll('line')
        .style('stroke', d => highlightedNodes.includes(d.target.data.id) && highlightedNodes.includes(d.source.data.id) ? 'darkorange' : 'gray');
      svg.selectAll('circle')
        .style('stroke-width', d => highlightedNodes.includes(d.data.id) ? 2 : 1)
        .style('stroke', d => highlightedNodes.includes(d.data.id) ? 'darkorange' : 'black');
    } else if (isQuerying && querySteps.length > 0 && currentQueryStep > 0) {
      const currentStepData = querySteps[currentQueryStep - 1];
      svg.selectAll('line')
        .style('stroke', d => currentStepData?.highlight.includes(d.target.data.id) && currentStepData?.highlight.includes(d.source.data.id) ? 'darkorange' : 'gray');
        svg.selectAll('circle')
          .style('stroke-width', d => currentStepData?.highlight.includes(d.data.id) || currentStepData?.visited.includes(d.data.id) ? 2 : 1)
          .style('stroke', d => currentStepData?.highlight.includes(d.data.id) ? 'darkorange' : (currentStepData?.visited.includes(d.data.id) ? 'black' : 'black'));
      } else if (isUpdating && updateSteps.length > 0 && currentUpdateStep > 0) {
        const currentStepData = updateSteps[currentUpdateStep - 1];
        svg.selectAll('line')
          .style('stroke', d => currentStepData?.highlight.includes(d.target.data.id) && currentStepData?.highlight.includes(d.source.data.id) ? 'lightgreen' : 'gray');
        svg.selectAll('circle')
          .style('stroke-width', d => currentStepData?.highlight.includes(d.data.id) || currentStepData?.visited.includes(d.data.id) ? 2 : 1)
          .style('stroke', d => currentStepData?.highlight.includes(d.data.id) ? 'lightgreen' : (currentStepData?.visited.includes(d.data.id) ? 'black' : 'black'));
      } else {
        svg.selectAll('line').style('stroke', 'gray');
        svg.selectAll('circle').style('stroke', 'black').style('stroke-width', 1);
      }
    }, [nodes, constructing, isQuerying, currentQueryStep, querySteps, currentConstructStep, steps, isUpdating, updateSteps, currentUpdateStep]);
  
    return (
      <div>
        <h2>Xây dựng và Truy vấn Cây Phân đoạn</h2>
        <div>
          <h3>Nhập dữ liệu</h3>
          <input type="text" placeholder="Tên" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder="Giá trị" value={population} onChange={(e) => setPopulation(e.target.value)} />
          <button onClick={handleAdd}>Thêm</button>
        </div>
  
        {locations.length > 0 && (
          <div>
            <h3>Dữ liệu đã nhập</h3>
            <ul>{locations.map((loc, idx) => <li key={idx}>{loc.name}: {loc.population}</li>)}</ul>
            <button onClick={handleBuildTree} disabled={treeBuilt || constructing || locations.length === 0}>
              {constructing ? 'Đang xây dựng...' : (treeBuilt ? 'Đã xây dựng cây' : 'Xây dựng cây')}
            </button>
          </div>
        )}
  
        {treeBuilt && (
          <div style={{ marginTop: '20px' }}>
            <h3>Truy vấn tổng trong khoảng</h3>
            <input type="number" placeholder="Chỉ số bắt đầu" ref={queryStartRef} />
            <input type="number" placeholder="Chỉ số kết thúc" ref={queryEndRef} />
            <button onClick={handleQuery} disabled={isQuerying || constructing || isUpdating}>Truy vấn</button>
            {queryResult !== null && <p>Tổng trong khoảng [{queryStartRef.current?.value}:{queryEndRef.current?.value}]: <b>{queryResult}</b></p>}
          </div>
        )}
  
        {treeBuilt && (
          <div style={{ marginTop: '20px' }}>
            <h3>Cập nhật giá trị tại chỉ số</h3>
            <input type="number" placeholder="Chỉ số cần cập nhật" value={updateIndex} onChange={(e) => setUpdateIndex(e.target.value)} />
            <input type="number" placeholder="Giá trị mới" value={updateValue} onChange={(e) => setUpdateValue(e.target.value)} />
            <button onClick={handleUpdate} disabled={isUpdating || constructing || isQuerying}>Cập nhật</button>
            {isUpdating && updateSteps.length > 0 && (
              <div>
                <h3>🔄 Quá trình cập nhật:</h3>
                <p>Bước cập nhật: {currentUpdateStep}/{updateSteps.length}</p>
                {updateSteps[currentUpdateStep - 1] && (
                  <div style={{ marginTop: '10px', fontSize: '14px' }}>
                    <p><strong>🟢 Highlight:</strong> {updateSteps[currentUpdateStep - 1].highlight.map(getNodeName).join(', ')}</p>
                    <p><strong>⚪ Đã thăm:</strong> {updateSteps[currentUpdateStep - 1].visited.map(getNodeName).join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
  
        <div style={{ display: 'flex', gap: '40px', marginTop: '30px' }}>
          <svg ref={svgRef} width={700} height={500}></svg>
          <div>
            {steps.length > 0 && constructing && (
              <div>
                <h3>📊 Quá trình xây dựng:</h3>
                <p>Bước: {currentConstructStep}/{steps.length}</p>
              </div>
            )}
            {querySteps.length > 0 && isQuerying && (
              <div>
                <h3>🔍 Quá trình truy vấn:</h3>
                <p>Bước truy vấn: {currentQueryStep}/{querySteps.length}</p>
                {querySteps[currentQueryStep - 1] && (
                  <div style={{ marginTop: '10px', fontSize: '14px' }}>
                    <p><strong>🔶 Highlight:</strong> {querySteps[currentQueryStep - 1].highlight.map(getNodeName).join(', ')}</p>
                    <p><strong>🟦 Đã thăm:</strong> {querySteps[currentQueryStep - 1].visited.map(getNodeName).join(', ')}</p>
                  </div>
                )}
              </div>
            )}
            {queryResult !== null && !isQuerying && (
              <div>
                <h3>Kết quả truy vấn:</h3>
                <p>Tổng trong khoảng [{queryStartRef.current?.value}:{queryEndRef.current?.value}]: <b>{queryResult}</b></p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
  
  export default SegmentTreeD3;