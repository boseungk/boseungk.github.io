---
layout: post
title: 게임 맵 최단거리
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 게임 맵 최단거리 - 프로그래머스

### 문제
[게임 맵 최단거리](https://school.programmers.co.kr/learn/courses/30/lessons/1844)

### 해설
* 최단거리이기 때문에 DFS보다 BFS가 적절하다(DFS는 끝까지 탐색해야 하지만 BFS는 해당 시점에서 종료가 가능하다)
* 방향벡터를 만들어주는 발상도, 계속 더해가는 발상도 처음이지만 좋은 거 같다.
* 대표유형 느낌이라서 여러번 풀어보면서 체화해야 할듯
```python
    def solution(self, graph):
        col = len(graph)
        row = len(graph[0])
        def bfs(a, b):  # y좌표, x좌표
            queue = collections.deque()
            queue.append([a, b])
            # graph[y][x]
            while queue:
                y, x = queue.popleft()
                dy = [1, -1, 0, 0]
                dx = [0, 0, 1, -1]
                for i in range(4):
                    ny = y + dy[i]
                    nx = x + dx[i]
                    if ny >= col or nx >= row or ny < 0 or nx < 0:
                        continue
                    if graph[ny][nx] == 0:
                        continue
                    if graph[ny][nx] == 1:
                        graph[ny][nx] = graph[y][x] + 1
                        queue.append([ny, nx])
            if graph[col-1][row-1] == 1:
                return -1
            else:
                return graph[col-1][row-1]
                
        return bfs(0, 0)
```