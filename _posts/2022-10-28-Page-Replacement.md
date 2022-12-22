---
layout: post
title: 페이지 교체 알고리즘(Page Replacement)
subtitle: FIFO, LRU, OPT
categories: Algorithm
tags: [Algorithm]
---

## 페이지 교체 알고리즘

### 개요
* 컴퓨터는 하드디스크, SSD, RAM등 대용량 저장장치를 가지고 있다. 하드디스크나 SSD같은 보조기억장치보단 주기억장치인 RAM이 속도가 더 빠르기 때문에 운영체제가 데이터를 RAM으로 가져와서 연산을 하게 된다. 이때 프로그램을 일정한 단위로 나눠서 RAM에서 사용하게 되는데, 이 단위를 Page라고 한다.
* 사용자가 Page를 요구 했을 때(Demand Paging), RAM에 Page가 있을 수 도 있고, 없을 수 도 있다. 만약 RAM에 Page가 없다면(Page fault), 추가로 보조 기억장치에서 불러와야 한다. 이때 물리적 거리 때문에 추가적인 시간과 자원을 필요로 하게 된다.(이것을 오버헤드라고 한다.)
* 또한 Page를 RAM으로 불러 올 때, 어떤 페이지(Victim Page)를 삭제해야 하는 문제가 발생한다. 많이 사용되는 페이지를 삭제한다면 추가적인 오버헤드가 발생하기 때문이다. 
* 이런 문제를 해결하기 위해서 다양한 알고리즘이 사용된다.
  * FIFO(First in First Out) 
  * LRU (Least Recently Used)
  * OPT (OPTimal Page Replacement)

### LRU(Last Rencently Used) 알고리즘
![LRU](https://user-images.githubusercontent.com/95980754/198833323-ec67ef22-6cd4-4ec9-9187-0d97617a4a87.png)

* LRU 알고리즘의 기본 전제는 '오래동안 사용하지 않은 페이지는 미래에도 사용할 가능성이 낮다'이다. 따라서 가장 오래된 페이지를 희생페이지로 선택해서 교체한다.
* 페이지 교체(Page Fault)는 2번, 페이지 갱신(Page hit)은 1번 발생한다.
