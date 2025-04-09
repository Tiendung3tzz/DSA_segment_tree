import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';

// Hàm xác định phép toán kết hợp cho cây phân đoạn
const combine = (a, b, type) => {
    if (type === 'sum') {
        return (a === null ? 0 : a) + (b === null ? 0 : b);
    } else if (type === 'min') {
        if (a === null) return b;
        if (b === null) return a;
        return Math.min(a, b);
    }
    return 0; // Default to sum if type is not recognized
};

function constructSTUtil(arr, ss, se, si, nodes, parent = null, steps = [], highlight = [], originalLocations, treeType, currentTree) {
    if (ss > se) return;
    const node = {
        id: si,
        name: `[${ss}:${se}] = ?`,
        leafName: ss === se ? `${originalLocations[ss]?.name}: ${originalLocations[ss]?.population}` : null,
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
        currentTree[si] = arr[ss];
        steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [] });
        return;
    }
    node.status = 'calculating';
    steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight] });
    const mid = Math.floor((ss + se) / 2);
    const leftChildIndex = si * 2 + 1;
    const rightChildIndex = si * 2 + 2;
    constructSTUtil(arr, ss, mid, leftChildIndex, nodes, si, steps, [...highlight, leftChildIndex], originalLocations, treeType, currentTree);
    constructSTUtil(arr, mid + 1, se, rightChildIndex, nodes, si, steps, [...highlight, rightChildIndex], originalLocations, treeType, currentTree);
    const leftNode = nodes.find(n => n.id === leftChildIndex);
    const rightNode = nodes.find(n => n.id === rightChildIndex);
    if (leftNode && rightNode && leftNode.status === 'completed' && rightNode.status === 'completed') {
        currentTree[si] = combine(leftNode.value, rightNode.value, treeType);
        node.value = currentTree[si];
        node.name =  `[${ss}:${se}] = ${currentTree[si]}`;
        node.status = 'completed';
        highlight = highlight.filter(h => h !== leftChildIndex && h !== rightChildIndex);
        steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight, si] });
    } else {
        steps.push({ nodes: nodes.map(n => ({ ...n })), highlight: [...highlight] });
    }
}

function constructST(arr, n, nodes, steps, originalLocations, treeType, setGeneratedTree) {
    const maxSize = 4 * n;
    const currentTree = new Array(maxSize).fill(null); // Khởi tạo mảng tree cục bộ
    constructSTUtil(arr, 0, n - 1, 0, nodes, null, steps, [0], originalLocations, treeType, currentTree);
    setGeneratedTree(currentTree); // Cập nhật state tree
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

function querySTUtil(si, ss, se, qs, qe, highlightSteps, currentResult, queryPath, visitedNodes, treeType, currentTree) {
    const currentHighlight = si !== null ? [...queryPath, si] : [...queryPath];
    const stepInfo = {
        highlight: currentHighlight.filter(val => val !== null),
        visited: Array.from(visitedNodes),
        currentNodeRange: si !== null ? `[${ss}:${se}]` : null,
        leftOperand: null,
        rightOperand: null,
        calculation: null,
        currentValue: currentTree[si] !== undefined ? currentTree[si] : null,
        inQueryRange: !(ss > qe || se < qs), // Thêm thông tin có nằm trong khoảng truy vấn không
    };

    if (ss > qe || se < qs) {
        visitedNodes.add(si);
        stepInfo.calculation = `[${ss}:${se}] nằm ngoài [${qs}:${qe}], đóng góp ${treeType === 'min' ? 'Infinity' : '0'}`;
        stepInfo.currentValue = treeType === 'min' ? Infinity : 0;
        highlightSteps.push(stepInfo);
        return treeType === 'min' ? Infinity : 0;
    }

    if (qs <= ss && se <= qe) {
        visitedNodes.add(si);
        stepInfo.calculation = `[${ss}:${se}] nằm hoàn toàn trong [${qs}:${qe}], lấy giá trị ${currentTree[si]}`;
        highlightSteps.push(stepInfo);
        return currentTree[si];
    }

    const mid = Math.floor((ss + se) / 2);
    visitedNodes.add(si);
    const leftChildIndex = si * 2 + 1;
    const rightChildIndex = si * 2 + 2;

    stepInfo.leftOperand = `query([${ss}:${mid}])`;
    stepInfo.rightOperand = `query([${mid+1}:${se}])`;
    highlightSteps.push(stepInfo);

    const leftResult = querySTUtil(leftChildIndex, ss, mid, qs, qe, highlightSteps, currentResult, currentHighlight, new Set([...visitedNodes]), treeType, currentTree);
    const rightResult = querySTUtil(rightChildIndex, mid + 1, se, qs, qe, highlightSteps, currentResult, currentHighlight, new Set([...visitedNodes]), treeType, currentTree);

    const combinedResult = combine(leftResult, rightResult, treeType);
    const updatedStepInfo = highlightSteps[highlightSteps.length - 1];
    updatedStepInfo.calculation = `[${ss}:${se}] = ${leftResult} ${treeType === 'sum' ? '+' : 'min'} ${rightResult} = ${combinedResult}`;
    updatedStepInfo.currentValue = combinedResult;

    return combinedResult;
}

function updateSTUtil(si, ss, se, i, newValue, updateSteps, updatePath, visitedNodes, treeType, currentTree) {
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
    if (ss === se) {
        currentTree[si] = newValue;
    } else {
        const mid = Math.floor((ss + se) / 2);
        updateSTUtil(si * 2 + 1, ss, mid, i, newValue, updateSteps, currentHighlight, new Set([...visitedNodes]), treeType, currentTree);
        updateSTUtil(si * 2 + 2, mid + 1, se, i, newValue, updateSteps, currentHighlight, new Set([...visitedNodes]), treeType, currentTree);
        const leftChildIndex = si * 2 + 1;
        const rightChildIndex = si * 2 + 2;
        currentTree[si] = combine(currentTree[leftChildIndex], currentTree[rightChildIndex], treeType);
    }
}

const SegmentTreeD3 = () => {
    const [provincesData, setProvincesData] = useState({});
    const [currentProvince, setCurrentProvince] = useState('');
    const [currentDistrictName, setCurrentDistrictName] = useState('');
    const [currentDistrictPopulation, setCurrentDistrictPopulation] = useState('');
    const [locations, setLocations] = useState([]);
    const [treeBuilt, setTreeBuilt] = useState(false);
    const [nodes, setNodes] = useState([]);
    const [steps, setSteps] = useState([]);
    const [constructing, setConstructing] = useState(false);
    const [currentConstructStep, setCurrentConstructStep] = useState(0);
    const [animationTimeoutId, setAnimationTimeoutId] = useState(null);
    const [constructionDelay] = useState(150);
    const [treeType, setTreeType] = useState('sum'); // Default tree type is sum
    const [generatedTree, setGeneratedTree] = useState([]); // State để lưu trữ mảng tree đã tạo

    const svgRef = useRef();
    const queryProvinceRef = useRef(null);
    const [queryResult, setQueryResult] = useState(null);
    const [querySteps, setQuerySteps] = useState([]);
    const [currentQueryStep, setCurrentQueryStep] = useState(0);
    const [isQuerying, setIsQuerying] = useState(false);
    const [queryAnimationTimeoutId, setQueryAnimationTimeoutId] = useState(null);
    const [queryAnimationDelay] = useState(500);

    const [updateIndex, setUpdateIndex] = useState('');
    const [updateValue, setUpdateValue] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateSteps, setUpdateSteps] = useState([]);
    const [currentUpdateStep, setCurrentUpdateStep] = useState(0);
    const [updateAnimationTimeoutId, setUpdateAnimationTimeoutId] = useState(null);
    const [updateAnimationDelay] = useState(1500);

    const [isProcessExpanded, setIsProcessExpanded] = useState(false);
    const [isQueryUpdateExpanded, setIsQueryUpdateExpanded] = useState(true); // Mặc định mở

    const resetTreeState = useCallback(() => {
        setTreeBuilt(false);
        setNodes([]);
        setSteps([]);
        setQueryResult(null);
        setQuerySteps([]);
        setCurrentQueryStep(0);
        setIsQuerying(false);
        setConstructing(false);
        setCurrentConstructStep(0);
        setIsUpdating(false);
        setUpdateSteps([]);
        setCurrentUpdateStep(0);
        setGeneratedTree([]); // Reset mảng tree
        if (animationTimeoutId) clearTimeout(animationTimeoutId);
        if (queryAnimationTimeoutId) clearTimeout(queryAnimationTimeoutId);
        if (updateAnimationTimeoutId) clearTimeout(updateAnimationTimeoutId);
    }, [animationTimeoutId, queryAnimationTimeoutId, updateAnimationTimeoutId]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const fileData = e.target.result;
                    const parsedData = JSON.parse(fileData);
                    if (typeof parsedData === 'object' && parsedData !== null) {
                        setProvincesData(parsedData);
                        resetTreeState();
                        alert('Dữ liệu từ file JSON đã được tải thành công!');
                    } else {
                        alert('Nội dung file JSON không hợp lệ. Vui lòng đảm bảo file chứa một đối tượng JSON.');
                    }
                } catch (error) {
                    alert('Lỗi khi đọc hoặc phân tích file JSON: ' + error.message);
                }
            };
            reader.readAsText(file);
        }
    };

    const handleAddDistrict = () => {
        if (currentProvince && currentDistrictName && !isNaN(currentDistrictPopulation)) {
            setProvincesData(prevData => {
                const newData = { ...prevData };
                const newDistrict = { name: currentDistrictName, population: Number(currentDistrictPopulation) };

                if (newData[currentProvince]) {
                    newData[currentProvince] = [...newData[currentProvince], newDistrict];
                } else {
                    newData[currentProvince] = [newDistrict];
                }
                return newData;
            });
            setCurrentDistrictName('');
            setCurrentDistrictPopulation('');
            resetTreeState();
        }
    };

    useEffect(() => {
        const newLocations = [];
        for (const province in provincesData) {
            newLocations.push(...provincesData[province].map(district => ({ province, ...district })));
        }
        setLocations(newLocations);
    }, [provincesData]);

    const handleBuildTree = () => {
        if (locations.length === 0) return;
        resetTreeState();
        setConstructing(true);
        const arr = locations.map((loc) => loc.population);
        const n = arr.length;
        const newNodes = [];
        const newSteps = [];
        constructST(arr, n, newNodes, newSteps, locations, treeType, setGeneratedTree);
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

    const handleQueryByProvince = () => {
        if (!treeBuilt || locations.length === 0) {
            alert('Vui lòng xây dựng cây trước khi truy vấn.');
            return;
        }
        const provinceName = queryProvinceRef.current.value;
        const startIndex = locations.findIndex(loc => loc.province === provinceName);
        const endIndex = locations.lastIndexOf(locations.findLast(loc => loc.province === provinceName));

        if (startIndex === -1) {
            alert(`Không tìm thấy tỉnh ${provinceName}.`);
            return;
        }

        setQueryResult(null);
        setQuerySteps([]);
        setCurrentQueryStep(0);
        setIsQuerying(true);

        const highlightSteps = [];
        const visitedNodes = new Set();
        querySTUtil(0, 0, locations.length - 1, startIndex, endIndex, highlightSteps, treeType === 'min' ? Infinity : 0, [], visitedNodes, treeType, generatedTree);
        setQueryResult(highlightSteps[highlightSteps.length - 1]?.currentValue);
        setQuerySteps(highlightSteps);
        setCurrentQueryStep(0);
    };

    useEffect(() => {
        if (isQuerying && querySteps.length > 0 && currentQueryStep < querySteps.length) {
            const timeoutId = setTimeout(() => {
                setCurrentQueryStep(prev => prev + 1);
            }, queryAnimationDelay);
            setQueryAnimationTimeoutId(timeoutId);
        } else if (isQuerying && currentQueryStep === querySteps.length) {
            setIsQuerying(false);
        }
        return () => clearTimeout(queryAnimationTimeoutId);
    }, [isQuerying, querySteps, currentQueryStep, queryAnimationDelay]);

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
        const newLocations = locations.map((loc, i) =>
            i === index ? { ...loc, population: value } : loc
        );
        setLocations(newLocations);

        const highlightSteps = [];
        const visitedNodes = new Set();
        const updatedTree = [...generatedTree]; // Tạo bản sao để cập nhật
        updateSTUtil(0, 0, locations.length - 1, index, value, highlightSteps, [], visitedNodes, treeType, updatedTree);
        setUpdateSteps(highlightSteps);
        setGeneratedTree(updatedTree); // Cập nhật state tree

        // Cập nhật state nodes để re-render cây với giá trị mới
        const updatedNodes = nodes.map(node => {
            if (node.range && node.range[0] <= index && node.range[1] >= index) {
                if (node.range[0] === node.range[1] && node.range[0] === index) {
                    return { ...node, value: value, name: `[${index}] = ${value}`, leafName: `${newLocations[index].name}: ${newLocations[index].population}` };
                } else if (node.status === 'completed') {
                    let newValue;
                    const [start, end] = node.range;
                    const relevantLocations = newLocations.slice(start, end + 1).map(loc => loc.population);
                    if (treeType === 'sum') {
                        newValue = relevantLocations.reduce((acc, val) => acc + val, 0);
                    } else if (treeType === 'min') {
                        newValue = Math.min(...relevantLocations);
                    } else {
                        newValue = 0;
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
        const width = 1500;
        const height = 400;
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const rootData = buildHierarchy(nodes);
        const hierarchy = d3.hierarchy(rootData);
        const treeLayout = d3.tree().size([width - 10, height - 15]);
        const treeData = treeLayout(hierarchy);

        const spacingX = 1; // Tăng khoảng cách ngang (thử các giá trị khác nhau)

        treeData.descendants().forEach(d => {
            d.x *= spacingX;
        });

        const links = treeData.links();
        svg.selectAll('.link')
            .data(links)
            .enter().append('path')
            .attr('class', 'link')
            .attr('d', d3.linkVertical()
                .x(d => d.x + 30)
                .y(d => d.y + 30))
            .style('fill', 'none')
            .style('stroke', '#ccc')
            .style('stroke-width', 1);

        const nodeGroup = svg.selectAll('.node')
            .data(treeData.descendants())
            .enter().append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x + 30}, ${d.y + 30})`);

        nodeGroup.append('circle')
            .attr('r', 20)
            .style('fill', d => {
                const isQueryHighlighted = isQuerying && querySteps[currentQueryStep - 1]?.highlight.includes(d.data.id) && querySteps[currentQueryStep - 1]?.inQueryRange;
                const isQueryVisited = isQuerying && querySteps[currentQueryStep - 1]?.visited.includes(d.data.id) && querySteps[currentQueryStep - 1]?.inQueryRange;
                const isUpdateHighlighted = isUpdating && updateSteps[currentUpdateStep - 1]?.highlight.includes(d.data.id);
                const isUpdateVisited = isUpdating && updateSteps[currentUpdateStep - 1]?.visited.includes(d.data.id);

                if (isQueryHighlighted) {
                    return '#ffeb3b'; // Màu vàng highlight truy vấn
                } else if (isQueryVisited) {
                    return '#00e7ff'; // Màu xanh dương đã thăm truy vấn
                } else if (isUpdateHighlighted) {
                    return '#66ff00'; // Màu xanh lá highlight cập nhật
                } else if (isUpdateVisited) {
                    return '#00e7ff'; // Màu xám đã thăm cập nhật
                } else if (treeBuilt) {
                    return '#a5a5a5'; // Màu sau khi xây dựng xong
                } else {
                    return constructing ? (d.data.status === 'completed' ? '#ff9800' : (d.data.status === 'calculating' ? '#f44336' : '#f0f0f0')) : '#f0f0f0';
                }
            })
            .style('stroke', '#333')
            .style('stroke-width', 1);

        // Thêm text cho tên node (bên trên)
        nodeGroup.append('text')
            .attr('dy', '-2.2em') // Đẩy lên trên
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .text(d => {
                if (d.data.leafName) {
                    const parts = d.data.leafName.split(': ');
                    return parts[0]; // Lấy tên
                }
                if (d.data.name && d.data.name.includes('=')) {
                    return d.data.name.split('=')[0].trim(); // Lấy phần trước dấu bằng và loại bỏ khoảng trắng
                }
                return d.data.name;
            });

        // Thêm text cho giá trị (bên dưới)
        nodeGroup.append('text')
            .attr('dy', '0.5em') // Đẩy xuống dưới
            .attr('x', 0)
            .attr('text-anchor', 'middle')
            .style('font-size', '9px')
            .style('font-weight', 'bold') // In đậm giá trị (tùy chọn)
            .text(d => {
                if (d.data.leafName) {
                    const parts = d.data.leafName.split(': ');
                    return parts[1]; // Lấy giá trị
                }
                return d.data.value !== null ? d.data.value : '';
            });
    }, [nodes, constructing, isQuerying, currentQueryStep, querySteps, currentConstructStep, steps, isUpdating, updateSteps, currentUpdateStep]);

    return (
        <div>
            <h2>Xây dựng và Truy vấn Cây Phân đoạn theo Tỉnh/Huyện</h2>
            <div>
                <h3>Chọn loại cây phân đoạn:</h3>
                <select value={treeType} onChange={(e) => setTreeType(e.target.value)}>
                    <option value="sum">Tổng</option>
                    <option value="min">Tối thiểu</option>
                </select>
            </div>
            <div>
                <h3>Nhập dữ liệu Tỉnh/Huyện</h3>
                <input
                    type="text"
                    placeholder="Tên tỉnh"
                    value={currentProvince}
                    onChange={(e) => setCurrentProvince(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Tên huyện"
                    value={currentDistrictName}
                    onChange={(e) => setCurrentDistrictName(e.target.value)}
                />
                <input
                    type="number"
                    placeholder="Dân số huyện"
                    value={currentDistrictPopulation}
                    onChange={(e) => setCurrentDistrictPopulation(e.target.value)}
                />
                <button onClick={handleAddDistrict}>Thêm Huyện</button>
            </div>
            <div>
                <h3>Tải dữ liệu từ file JSON</h3>
                <input type="file" accept=".json" onChange={handleFileChange} />
            </div>

            {Object.keys(provincesData).length > 0 && (
                <div>
                    <h3>Dữ liệu đã nhập</h3>
                    <ul>
                        {Object.entries(provincesData).map(([province, districts]) => (
                            <li key={province}>
                                <strong>{province}:</strong>
                                <ul>
                                    {districts.map((district, index) => (
                                        <li key={index}>{district.name}: {district.population}</li>
                                    ))}
                                </ul>
                            </li>
                        ))}
                    </ul>
                    <button onClick={handleBuildTree} disabled={treeBuilt || constructing || locations.length === 0}>
                        {constructing ? 'Đang xây dựng...' : (treeBuilt ? 'Đã xây dựng cây' : 'Xây dựng cây')}
                    </button>
                </div>
            )}

            <div style={{ position: 'relative', marginTop: '30px' }}>
                {/* Nút điều khiển mở/đóng */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-10px', // Điều chỉnh vị trí dọc
                        right: '-10px', // Đẩy ra ngoài lề phải
                        zIndex: 10, // Đảm bảo nút ở trên cùng
                        cursor: 'pointer',
                        backgroundColor: '#555', // Màu nền nút
                        color: 'white',
                        padding: '5px',
                        borderRadius: '5px 0 0 5px',
                    }}
                    onClick={() => setIsProcessExpanded(!isProcessExpanded)}
                >
                    {isProcessExpanded ? '<' : '>'}
                </div>

                {/* Thẻ quá trình (ẩn/hiện dựa trên trạng thái) */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-10px',
                        right: '9px', // Luôn giữ ở vị trí bên phải
                        width: '350px', // Tăng chiều rộng để hiển thị thông tin đầy đủ
                        backgroundColor: '#f8f8f8',
                        border: '1px solid #ccc',
                        padding: '15px',
                        zIndex: 5,
                        transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
                        boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.1)',
                        overflowY: 'auto',
                        maxHeight: '400px',
                        opacity: isProcessExpanded ? '1' : '0',
                        visibility: isProcessExpanded ? 'visible' : 'hidden',
                        fontSize: '14px', // Tăng kích thước font chữ cho dễ đọc
                    }}
                >
                    {/* Nội dung thẻ quá trình */}
                    {(steps.length > 0 && constructing) && (
                        <div>
                            <h3>📊 Quá trình xây dựng:</h3>
                            <p>Bước: {currentConstructStep}/{steps.length}</p>
                            {steps[currentConstructStep - 1]?.highlight.length > 0 && (
                                <p><strong>Highlight:</strong> {steps[currentConstructStep - 1].highlight.map(getNodeName).join(', ')}</p>
                            )}
                        </div>
                    )}
                    {(querySteps.length > 0 && isQuerying) && (
                        <div>
                            <h3>🔍 Quá trình truy vấn ({treeType === 'sum' ? 'Tổng' : 'Tối thiểu'}):</h3>
                            <p>Bước truy vấn: {currentQueryStep}/{querySteps.length}</p>
                            {querySteps[currentQueryStep - 1] && (
                                <div style={{ marginTop: '10px' }}>
                                    <p>
                                        <strong>Node hiện tại:</strong> {querySteps[currentQueryStep - 1].currentNodeRange}
                                        {querySteps[currentQueryStep - 1].currentValue !== null && ` = ${querySteps[currentQueryStep - 1].currentValue}`}
                                    </p>
                                    {querySteps[currentQueryStep - 1].leftOperand && (
                                        <p>
                                            <strong>➡️ Con trái:</strong> {querySteps[currentQueryStep - 1].leftOperand}
                                        </p>
                                    )}
                                    {querySteps[currentQueryStep - 1].rightOperand && (
                                        <p>
                                            <strong>➡️ Con phải:</strong> {querySteps[currentQueryStep - 1].rightOperand}
                                        </p>
                                    )}
                                    {querySteps[currentQueryStep - 1].calculation && (
                                        <p>
                                            <strong>Tính toán:</strong> {querySteps[currentQueryStep - 1].calculation}
                                        </p>
                                    )}
                                    {querySteps[currentQueryStep - 1].visited.length > 0 && (
                                        <p>
                                            <strong>Đã thăm:</strong> {querySteps[currentQueryStep - 1].visited.map(id => getNodeName(id).split('=')[0].trim()).join(', ')}
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                    {(queryResult !== null && !isQuerying) && (
                        <div>
                            <h3>Kết quả truy vấn ({treeType === 'sum' ? 'Tổng' : 'Tối thiểu'}):</h3>
                            <p>
                                {treeType === 'sum' ? 'Tổng' : 'Giá trị tối thiểu'} của tỉnh {queryProvinceRef.current?.value}: <b>{queryResult}</b>
                            </p>
                        </div>
                    )}
                    {(isUpdating && updateSteps.length > 0) && (
                        <div>
                            <h3>🔄 Quá trình cập nhật:</h3>
                            <p>Bước cập nhật: {currentUpdateStep}/{updateSteps.length}</p>
                            {updateSteps[currentUpdateStep - 1] && (
                                <div style={{ marginTop: '10px' }}>
                                    <p>
                                        <strong>🟢 Highlight:</strong> {updateSteps[currentUpdateStep - 1].highlight.map(getNodeName).join(', ')}
                                    </p>
                                    <p>
                                        <strong>⚪ Đã thăm:</strong> {updateSteps[currentUpdateStep - 1].visited.map(getNodeName).join(', ')}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Thẻ cây (SVG) */}
            <svg ref={svgRef} width={2000} height={800}></svg>

            <div style={{ position: 'relative', marginTop: '20px' }}>
                {/* Nút điều khiển mở/đóng cho Truy vấn/Cập nhật */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-847px', // Điều chỉnh vị trí dọc
                        left: '7px', // Đẩy ra ngoài lề phải
                        zIndex: 10,
                        cursor: 'pointer',
                        backgroundColor: '#555',
                        color: 'white',
                        padding: '5px',
                        borderRadius: '5px 0 0 5px',
                    }}
                    onClick={() => setIsQueryUpdateExpanded(!isQueryUpdateExpanded)}
                >
                    {isQueryUpdateExpanded ? '<' : '>'}
                </div>

                {/* Container cho Truy vấn và Cập nhật */}
                <div
                    style={{
                        position: 'absolute',
                        top: '-847px',
                        left: '28px',
                        opacity: isQueryUpdateExpanded ? '1' : '0',
                        visibility: isQueryUpdateExpanded ? 'visible' : 'hidden',
                        transition: 'opacity 0.3s ease-in-out, visibility 0.3s ease-in-out',
                        padding: '15px',
                        border: '1px solid #ccc',
                        backgroundColor: '#f8f8f8',
                        boxShadow: '2px 2px 5px rgba(0, 0, 0, 0.1)',
                    }}
                >
                    {/* Phần Truy vấn tổng/tối thiểu theo Tỉnh */}
                    <div>
                        <h3>Truy vấn {treeType === 'sum' ? 'tổng' : 'tối thiểu'} theo Tỉnh</h3>
                        <select ref={queryProvinceRef}>
                            <option value="">-- Chọn tỉnh --</option>
                            {Object.keys(provincesData).map(province => (
                                <option key={province} value={province}>{province}</option>
                            ))}
                        </select>
                        <button onClick={handleQueryByProvince} disabled={isQuerying || constructing || isUpdating}>
                            Truy vấn
                        </button>
                        {queryResult !== null && (
                            <p>
                                {treeType === 'sum' ? 'Tổng' : 'Giá trị tối thiểu'} của tỉnh {queryProvinceRef.current?.value}: <b>{queryResult}</b>
                            </p>
                        )}
                    </div>

                    {/* Phần Cập nhật dân số huyện */}
                    <div style={{ marginTop: '20px' }}>
                        <h3>Cập nhật dân số huyện</h3>
                        <select
                            value={updateIndex}
                            onChange={(e) => setUpdateIndex(e.target.value)}
                        >
                            <option value="">-- Chọn huyện --</option>
                            {locations.map((location, index) => (
                                <option key={index} value={index}>
                                    {location.name} ({location.province}) - Chỉ số: {index}
                                </option>
                            ))}
                        </select>
                        <input
                            type="number"
                            placeholder="Giá trị dân số mới"
                            value={updateValue}
                            onChange={(e) => setUpdateValue(e.target.value)}
                            style={{ marginLeft: '10px' }}
                        />
                        <button onClick={handleUpdate}disabled={isUpdating || constructing || isQuerying}
                            style={{ marginLeft: '10px' }}
                        >
                            Cập nhật
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SegmentTreeD3;