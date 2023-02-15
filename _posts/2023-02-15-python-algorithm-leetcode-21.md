---
layout: post
title: 두 정렬 리스트의 병합
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 두 정렬 리스트의 병합 - leetcode 21번

[21. Merge Two Sorted Lists](https://leetcode.com/problems/merge-two-sorted-lists/)

입력값 l1: 1->2->4, l2: 1->3->4

출력값 1->1->2->3->4->4

### 해설

1. 입력값을 한쪽으로 모으는 것에서 시작한다.
   1. 크기를 비교해서 작은쪽으로 모으기로 하자.
   2. 이때 l1, l2 = l2, l1을 이용해서 l1으로 모은다.
   3. 노드 간에 연결은 아직 이뤄지지 않았다.
2. 크기 비교가 끝난 노드 간의 연결을 만들어준다.
   1. l1.next = self.mergeTwoLists(l1.next, l2)
      1. self.mergeTwoLists(l1.next, l2)의 경우 l1 다음노드와 l2의 비교를 의미한다.
      2. self.mergeTwoLists(l1.next, l2)의 리턴값은 미래에서 l1에서 비교가 끝난 후 연결이 이뤄진 노드들이다
3. 노드의 이동이 끝나고 None처리도 해줘야 한다.
   1. if not l1
   2. if l1
      1. 이렇게 마지막 노드 처리까지 해준다.

### 풀이

```python
    class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next


class Solution:
    def solution(self, l1, l2):
        if not l1 or l2 and l1.val > l2.val:
            l1, l2 = l2, l1
        if l1:
            l1.next = self.solution(l1.next, l2)
        return l1

l1 = ListNode(1)
l1.next = ListNode(2)
l1.next.next = ListNode(4)

l2 = ListNode(1)
l2.next = ListNode(3)
l2.next.next = ListNode(4)

answer = Solution().solution(l1, l2)
while answer is not None:
    print(f'{answer.val} ->', end=" ")
    answer = answer.next
```