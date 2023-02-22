---
layout: post
title: 최소 높이 트리
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 최소 높이 트리 - leetcode 49번

### 문제
[110. Balanced Binary Tree](https://leetcode.com/problems/balanced-binary-tree/description/)

1. 무뱡항이라서 모든 노드들이 동등함
   1. 따라서 dictionary로 모든 노드들에서 접근 가능한 노드 리스트 만들어주기
2. leaf 노드들을 계속 제거하면 최종 루트 노드를 구할 수 있음
3. 코드 짜다가 변수가 많아서 헷갈렸는데, 변수명의 중요성에 대해서 깨닫게 됨..

```python
class Solution:
    def solution(self, n: int, edge: List[List[int]]) -> List[int]:
        graph = collections.defaultdict(list)

        for v1, v2 in edge:
            graph[v1].append(v2)
            graph[v2].append(v1)
        leaves = []
        for key in graph:
            if len(graph[key]) == 1: # node가 1개일때
                leaves.append(key) # key -> leaves에 저장

        while n > 2:
            n -= len(leaves)
            new_leaves = []
            for node_1 in leaves:
                key_leaf = graph[node_1].pop()
                graph[key_leaf].remove(node_1)
                if len(graph[key_leaf]) == 1:
                    new_leaves.append(key_leaf)
            leaves = new_leaves
        return leaves
n = 4
edge = [[1, 0], [1, 2], [1, 3]]
result = Solution().solution(n, edge)
print(result)

```