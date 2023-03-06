---
layout: post
title: 주유소
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 주유소 - leetcode 81번

### 문제
[134. Gas Station](https://leetcode.com/problems/gas-station/description/)

### 해설
* 문제에서 조건을 빠뜨리고 제대로 유도해내지 못해서 꽤 헤맸음 
* 조건에서 답이 명확히 정해지지 않고 여러개로 나온다면 반대로 부정해서 if 조건을 세워주면 의외로 쉽게 해결될 수 도 있음

### 풀이
```python
class Solution:
    def canCompleteCircuit(self, gas: List[int], cost: List[int]) -> int:
        if sum(gas) < sum(cost):
            return -1
        tank = 0
        result = 0
        for i in range(len(gas)):
            tank += gas[i] - cost[i]
            if tank < 0:
                tank = 0
                result = i + 1
        return result
```