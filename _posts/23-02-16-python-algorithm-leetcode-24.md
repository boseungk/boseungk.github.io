---
layout: post
title: 페어의 노드 스왑
subtitle: 파이썬 알고리즘 
categories: Algorithm
tags: [Algorithm]
---
## 페어의 노드 스왑 - leetcode 24번

### 문제

[24. Swap Nodes in Pairs](https://leetcode.com/problems/swap-nodes-in-pairs/)

입력: 1->2->3->4

출력: 2->1->4->3

### 해설 1 (반복)

    1.  두 개 단위로 스왑이 이루어지므로 포인터 두 개를 사용한다. 
        1.  prev, head 
        2.  prev.next = head
   
    2.  연결리스트는 단순하게 값만 바꾸는것과는 달리 노드의 연결관계까지 고려해서 바꿔주어야 한다. 
        ex) 만약 3->2 연결관계를 바꾸려고 한다면 1->3, 2->4의 연결관계도 바꿔주어야 한다. 
        결과적으로 1->3->2->4

    3. 코딩 언어의 특성상 다음처럼 생각하는것이 이해하기 쉽다. 
       1. 바꾸려는 연결관계(왼쪽) = 목표노드(오른쪽)
   
    4. 2, 3을 종합해서 코드를 분석해보자. 
       
       1. 1->2->3->4에서 1->3->2->4로 바꾸려고 한다.
       2. b = head.next ex)1(prev) 3(h), 2(head.next == b)
       3. head.next = b.next ex) head.next(2의 연결관계) -> head.next.next(4 노드)
       4. b.next = head ex) 3->2로 연결관계 변경
       5. prev.next = b ex) 1->3
       6. 결과적으로 1->2->3->4
       7. head, prev = head.next, prev.next.next(다음 페어로 이동)

### 풀이 1
```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class Solution:
    def solution(self, head: ListNode) -> list:
        root = prev = ListNode(None)
        prev.next = head
        while head and head.next:
            b = head.next
            head.next = b.next
            b.next = head
            prev.next = b
            head = head.next
            prev = prev.next.next
        return root.next


l1 = ListNode(1)
l1.next = ListNode(2)
l1.next.next = ListNode(3)
l1.next.next.next = ListNode(4)
answer = Solution().solution(l1)
print(answer)
```
### 해설 2 (재귀)
1. 마찬가지로 한 쌍의 노드를 가리키게 위해서 포인터 두 개 필요
   1. head, p = head.next
2. self.solution(p.next)로 다음 노드들의 모든 노드가 페어 관계를 가지도록 만들기
3. 그리고 if head and head.next와 return을 이용해서 마지막 노드처리 해주기
    
    ```python
        def solution(self, head)
            if head and head.next:
                p = head.next
                self.solution(p.next)
                return p
    ```
4. 연결관계 만들어주기
   1. head.next = self.solution(p.next) 2->4
   2. p.next = head 3->2
   3. return p (3, 1, 2이 재귀적으로 백트래킹)


### 풀이 2
```python
class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

class Solution:
    def solution(self, head: ListNode) -> list:
        if head and head.next:
            p = head.next
            head.next = self.solution(p.next)
            p.next = head
            return head
        return head


l1 = ListNode(1)
l1.next = ListNode(2)
l1.next.next = ListNode(3)
l1.next.next.next = ListNode(4)
answer = Solution().solution(l1)
print(answer)

```

